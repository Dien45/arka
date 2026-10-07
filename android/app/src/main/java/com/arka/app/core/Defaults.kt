package com.arka.app.core

// Ported from src/store.tsx (defaultAgents / defaultProviders).
val defaultAgents: List<Agent> = listOf(
    Agent(
        id = "1",
        name = "Code Architect",
        description = "Membantu merancang arsitektur dan struktur proyek",
        icon = "🏗️",
        systemPrompt = "You are a senior software architect. Help design clean, scalable code architectures.",
        tools = listOf("read_file", "write_file", "search", "terminal"),
        provider = Provider.openai,
        model = "gpt-4o",
    ),
    Agent(
        id = "2",
        name = "Bug Hunter",
        description = "Mendeteksi dan memperbaiki bug dalam kode",
        icon = "🐛",
        systemPrompt = "You are an expert debugger. Analyze code carefully and find bugs, then fix them.",
        tools = listOf("read_file", "search", "terminal", "linter"),
        provider = Provider.anthropic,
        model = "claude-sonnet-4-20250514",
    ),
    Agent(
        id = "3",
        name = "Full Stack Dev",
        description = "Developer serba bisa untuk frontend dan backend",
        icon = "💻",
        systemPrompt = "You are a full-stack developer proficient in React, Node.js, databases, and DevOps.",
        tools = listOf("read_file", "write_file", "terminal", "search", "browser"),
        provider = Provider.google,
        model = "gemini-2.0-flash",
    ),
)

val defaultProviders: List<ProviderConfig> = listOf(
    ProviderConfig(id = Provider.openai, name = "OpenAI", baseUrl = "https://api.openai.com/v1", model = "gpt-4o", icon = "🟢"),
    ProviderConfig(id = Provider.anthropic, name = "Anthropic", baseUrl = "https://api.anthropic.com", model = "claude-sonnet-4-20250514", icon = "🟠"),
    ProviderConfig(id = Provider.google, name = "Google AI", baseUrl = "https://generativelanguage.googleapis.com", model = "gemini-2.0-flash", icon = "🔵"),
    ProviderConfig(id = Provider.groq, name = "Groq", baseUrl = "https://api.groq.com/openai/v1", model = "llama-3.3-70b-versatile", icon = "⚡"),
    ProviderConfig(id = Provider.openrouter, name = "OpenRouter", baseUrl = "https://openrouter.ai/api/v1", model = "auto", icon = "🔀"),
    ProviderConfig(id = Provider.ollama, name = "Ollama (Local)", baseUrl = "", model = "llama3.1", icon = "🦙"),
    ProviderConfig(id = Provider.custom, name = "Custom", baseUrl = "", model = "", icon = "⚙️"),
)