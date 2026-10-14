package com.arka.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.arka.app.ui.clay.ProvideClayColors

private val LightColors = lightColorScheme(
    primary = ArkaPrimary,
    onPrimary = ArkaOnPrimary,
    primaryContainer = ArkaPrimaryDark,
    onPrimaryContainer = ArkaOnPrimary,
    secondary = ArkaPrimaryDark,
    onSecondary = ArkaOnPrimary,
    background = ArkaBackground,
    onBackground = ArkaTextPrimary,
    surface = ArkaSurface,
    onSurface = ArkaTextPrimary,
    surfaceVariant = ArkaHover,
    onSurfaceVariant = ArkaTextSecondary,
    outline = ArkaBorder,
    error = ArkaError,
    onError = ArkaOnPrimary,
    tertiary = ArkaSuccess,
)

private val DarkColors = darkColorScheme(
    primary = DarkPrimary,
    onPrimary = Color(0xFF101722),
    secondary = DarkPrimary,
    onSecondary = Color(0xFF101722),
    background = DarkBackground,
    onBackground = DarkText,
    surface = DarkSurface,
    onSurface = DarkText,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = Color(0xFFA7B4C4),
    outline = DarkBorder,
    error = ArkaError,
    onError = Color(0xFF101722),
    tertiary = ArkaSuccess,
)

private val ArkaShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = RoundedCornerShape(14.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

@Composable
fun ArkaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = ArkaTypography,
        shapes = ArkaShapes,
    ) {
        ProvideClayColors(dark = darkTheme, content = content)
    }
}