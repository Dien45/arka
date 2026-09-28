import { GitHubRepo } from './types';

export async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch repos: ${response.statusText}`);
  }

  const repos = await response.json();
  return repos.map((repo: any) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || '',
    private: repo.private,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at,
  }));
}

export async function pushToGitHub(
  token: string,
  repoFullName: string,
  branch: string,
  files: { path: string; content: string | null }[],
  commitMessage: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get the latest commit SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/ref/heads/${branch}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!refResponse.ok) {
      throw new Error(`Branch ${branch} not found`);
    }

    const refData = await refResponse.json();
    const latestCommitSha = refData.object.sha;

    // Get the tree SHA from the latest commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits/${latestCommitSha}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    const commitData = await commitResponse.json();
    const treeSha = commitData.tree.sha;

    // Create blobs for each file to add/update. Files with content === null
    // are deletions: a tree entry with sha: null removes that path from the
    // resulting tree — no blob needed for those.
    const treeItems = await Promise.all(
      files.map(async (file) => {
        if (file.content === null) {
          return {
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: null,
          };
        }

        const blobResponse = await fetch(
          `https://api.github.com/repos/${repoFullName}/git/blobs`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: file.content,
              encoding: 'utf-8',
            }),
          }
        );

        if (!blobResponse.ok) {
          throw new Error(`Failed to create blob for ${file.path}`);
        }

        const blobData = await blobResponse.json();
        return {
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        };
      })
    );

    // Create a new tree
    const newTreeResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_tree: treeSha,
          tree: treeItems,
        }),
      }
    );

    if (!newTreeResponse.ok) {
      throw new Error('Failed to create tree');
    }

    const newTreeData = await newTreeResponse.json();

    // Create a new commit
    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage,
          tree: newTreeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );

    if (!newCommitResponse.ok) {
      throw new Error('Failed to create commit');
    }

    const newCommitData = await newCommitResponse.json();

    // Update the reference to point to the new commit
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: newCommitData.sha,
        }),
      }
    );

    if (!updateRefResponse.ok) {
      throw new Error('Failed to update reference');
    }

    const additions = files.filter(f => f.content !== null).length;
    const deletions = files.filter(f => f.content === null).length;
    const parts = [];
    if (additions > 0) parts.push(`${additions} file ditambah/diupdate`);
    if (deletions > 0) parts.push(`${deletions} file dihapus`);

    return {
      success: true,
      message: `Berhasil push ke ${branch}: ${parts.join(', ')}.`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function getGitHubUser(token: string): Promise<{ login: string; name: string; scopes: string[] }> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const user = await response.json();
  // GitHub returns the token's OAuth scopes in this response header — used
  // to warn the user if their PAT is broader than this app actually needs
  // (least-privilege: Arka only needs repo read/write, nothing else).
  const scopesHeader = response.headers.get('x-oauth-scopes') || '';
  const scopes = scopesHeader.split(',').map(s => s.trim()).filter(Boolean);

  return {
    login: user.login,
    name: user.name || user.login,
    scopes,
  };
}

/** Scopes Arka actually needs. Anything beyond this is unnecessary risk if the token ever leaks. */
export const REQUIRED_GITHUB_SCOPES = ['repo'];

export function getExcessiveScopes(scopes: string[]): string[] {
  return scopes.filter(s => !REQUIRED_GITHUB_SCOPES.includes(s));
}
