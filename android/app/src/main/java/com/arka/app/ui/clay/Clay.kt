package com.arka.app.ui.clay

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.arka.app.ui.theme.ArkaError
import com.arka.app.ui.theme.ArkaPrimary
import com.arka.app.ui.theme.ArkaSuccess
import com.arka.app.ui.theme.ArkaTextPrimary
import com.arka.app.ui.theme.ClayBaseDark
import com.arka.app.ui.theme.ClayBaseLight
import com.arka.app.ui.theme.ClayHighlightDark
import com.arka.app.ui.theme.ClayHighlightLight
import com.arka.app.ui.theme.ClayPressedDark
import com.arka.app.ui.theme.ClayPressedLight
import com.arka.app.ui.theme.ClayRingDark
import com.arka.app.ui.theme.ClayRingLight
import com.arka.app.ui.theme.ClayShadowDark
import com.arka.app.ui.theme.ClayShadowLight
import com.arka.app.ui.theme.ClaySurfaceAccentDark
import com.arka.app.ui.theme.ClaySurfaceAccentLight
import com.arka.app.ui.theme.DarkText
import com.arka.app.ui.theme.DarkPrimary

/**
 * Claymorphism color set: a soft pastel base with a light highlight plate (top-left)
 * and a dark shadow plate (bottom-right). All values are plain Colors — no dependency.
 */
@Immutable
data class ClayColors(
    val base: Color,
    val baseVariant: Color,
    val accent: Color,
    val onAccent: Color,
    val highlight: Color,
    val shadow: Color,
    val pressed: Color,
    val ring: Color,
    val text: Color,
    val primary: Color,
    val error: Color,
    val success: Color,
)

internal val ClayColorsLight = ClayColors(
    base = ClayBaseLight,
    baseVariant = ClaySurfaceAccentLight,
    accent = ArkaPrimary,
    onAccent = Color.White,
    highlight = ClayHighlightLight,
    shadow = ClayShadowLight,
    pressed = ClayPressedLight,
    ring = ClayRingLight,
    text = ArkaTextPrimary,
    primary = ArkaPrimary,
    error = ArkaError,
    success = ArkaSuccess,
)

internal val ClayColorsDark = ClayColors(
    base = ClayBaseDark,
    baseVariant = ClaySurfaceAccentDark,
    accent = DarkPrimary,
    onAccent = Color(0xFF101722),
    highlight = ClayHighlightDark,
    shadow = ClayShadowDark,
    pressed = ClayPressedDark,
    ring = ClayRingDark,
    text = DarkText,
    primary = DarkPrimary,
    error = ArkaError,
    success = ArkaSuccess,
)

val LocalClayColors = staticCompositionLocalOf { ClayColorsLight }

@Composable
fun ProvideClayColors(dark: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalClayColors provides if (dark) ClayColorsDark else ClayColorsLight,
        content = content,
    )
}

enum class ClayState { Raised, Flat, Pressed }

enum class ClayTone { Base, Accent, Inset }

enum class ClayVariant { Primary, Secondary, Ghost, Destructive }

object ClayShape {
    val Card = RoundedCornerShape(22.dp)
    val Button = RoundedCornerShape(18.dp)
    val Input = RoundedCornerShape(18.dp)
    val Chip = RoundedCornerShape(50)
    val Row = RoundedCornerShape(14.dp)
    val Sheet = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
}

object ClayDepth {
    val Plate = 2.5.dp
    val Bevel = 1.dp
}

private fun Shape.cornerRadiusPx(size: Size, density: androidx.compose.ui.unit.Density): CornerRadius {
    val shape = this as? CornerBasedShape ?: return CornerRadius.Zero
    val top = shape.topStart.toPx(size, density)
    return CornerRadius(top, top)
}

/**
 * Draws the two clay plates behind the caller's own background fill.
 * [ClayState.Raised] adds a light plate top-left and a dark plate bottom-right.
 * [ClayState.Pressed] draws an inset bevel in the shadow color.
 * [ClayState.Flat] draws nothing.
 */
fun Modifier.clay(
    colors: ClayColors,
    state: ClayState = ClayState.Raised,
    shape: Shape = ClayShape.Card,
    offset: Dp = ClayDepth.Plate,
): Modifier = drawBehind {
    val cr = shape.cornerRadiusPx(size, this)
    when (state) {
        ClayState.Raised -> {
            val o = offset.toPx()
            drawRoundRect(
                color = colors.shadow,
                topLeft = Offset(o, o),
                size = size,
                cornerRadius = cr,
            )
            drawRoundRect(
                color = colors.highlight,
                topLeft = Offset(-o, -o),
                size = size,
                cornerRadius = cr,
            )
        }
        ClayState.Pressed -> {
            val b = ClayDepth.Bevel.toPx()
            drawRoundRect(
                color = colors.shadow,
                topLeft = Offset(b, b),
                size = Size(size.width - b, size.height - b),
                cornerRadius = cr,
                style = Stroke(width = b),
            )
        }
        ClayState.Flat -> Unit
    }
}

@Composable
fun ClaySurface(
    modifier: Modifier = Modifier,
    state: ClayState = ClayState.Raised,
    tone: ClayTone = ClayTone.Base,
    shape: Shape = ClayShape.Card,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    contentColor: Color = Color.Unspecified,
    content: @Composable () -> Unit,
) {
    val c = LocalClayColors.current
    val bg = when (tone) {
        ClayTone.Base -> c.base
        ClayTone.Accent -> c.accent
        ClayTone.Inset -> c.pressed
    }
    val fg = if (contentColor != Color.Unspecified) contentColor
    else if (tone == ClayTone.Accent) c.onAccent else c.text
    val shapeMod = modifier.clay(c, state, shape)
    if (onClick != null) {
        Surface(
            onClick = onClick,
            modifier = shapeMod,
            enabled = enabled,
            shape = shape,
            color = bg,
            contentColor = fg,
        ) { content() }
    } else {
        Surface(
            modifier = shapeMod,
            shape = shape,
            color = bg,
            contentColor = fg,
        ) { content() }
    }
}

@Composable
fun ClayCard(
    modifier: Modifier = Modifier,
    state: ClayState = ClayState.Raised,
    tone: ClayTone = ClayTone.Base,
    shape: Shape = ClayShape.Card,
    contentPadding: PaddingValues = PaddingValues(12.dp),
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    ClaySurface(
        modifier = modifier,
        state = state,
        tone = tone,
        shape = shape,
        onClick = onClick,
        enabled = enabled,
    ) {
        Column(Modifier.padding(contentPadding), content = content)
    }
}

@Composable
fun ClayButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    variant: ClayVariant = ClayVariant.Primary,
    shape: Shape = ClayShape.Button,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 9.dp),
    content: @Composable RowScope.() -> Unit,
) {
    val c = LocalClayColors.current
    val bg = when (variant) {
        ClayVariant.Primary -> c.primary
        ClayVariant.Secondary -> c.base
        ClayVariant.Ghost -> Color.Transparent
        ClayVariant.Destructive -> c.error
    }
    val fg = when (variant) {
        ClayVariant.Primary -> c.onAccent
        ClayVariant.Destructive -> Color.White
        ClayVariant.Secondary -> c.text
        ClayVariant.Ghost -> c.primary
    }
    val state = if (variant == ClayVariant.Ghost) ClayState.Flat else ClayState.Raised
    Surface(
        onClick = onClick,
        modifier = Modifier
            .then(modifier)
            .clay(c, state, shape),
        enabled = enabled,
        shape = shape,
        color = bg,
        contentColor = fg,
    ) {
        Row(
            Modifier.padding(contentPadding),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

@Composable
fun ClayIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    variant: ClayVariant = ClayVariant.Ghost,
    size: Dp = 40.dp,
    content: @Composable () -> Unit,
) {
    ClayButton(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        variant = variant,
        shape = CircleShape,
        contentPadding = PaddingValues(0.dp),
    ) {
        Box(Modifier.size(size), contentAlignment = Alignment.Center) { content() }
    }
}

@Composable
fun ClayChip(
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    label: @Composable () -> Unit,
) {
    val c = LocalClayColors.current
    val fg = if (selected) c.onAccent else c.text
    Surface(
        onClick = onClick,
        modifier = modifier.clay(c, if (selected) ClayState.Raised else ClayState.Flat, ClayShape.Chip),
        enabled = enabled,
        shape = ClayShape.Chip,
        color = if (selected) c.accent else c.base,
        contentColor = fg,
    ) {
        Box(
            Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center,
        ) { label() }
    }
}

@Composable
fun ClayRow(
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    val c = LocalClayColors.current
    Surface(
        modifier = Modifier
            .then(modifier)
            .clay(c, if (selected) ClayState.Raised else ClayState.Flat, ClayShape.Row),
        shape = ClayShape.Row,
        color = if (selected) c.baseVariant else Color.Transparent,
        contentColor = if (selected) c.text else LocalContentColor.current,
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(enabled = enabled, onClick = onClick),
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

@Composable
fun ClayTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    textStyle: TextStyle = LocalTextStyle.current,
    label: @Composable (() -> Unit)? = null,
    placeholder: @Composable (() -> Unit)? = null,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    prefix: @Composable (() -> Unit)? = null,
    suffix: @Composable (() -> Unit)? = null,
    supportingText: @Composable (() -> Unit)? = null,
    isError: Boolean = false,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    singleLine: Boolean = false,
    maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    minLines: Int = 1,
    shape: Shape = ClayShape.Input,
    colors: TextFieldColors? = null,
) {
    val c = LocalClayColors.current
    val clayColors = colors ?: OutlinedTextFieldDefaults.colors(
        focusedContainerColor = c.base,
        unfocusedContainerColor = c.base,
        disabledContainerColor = c.pressed,
        focusedBorderColor = c.primary,
        unfocusedBorderColor = c.ring,
        errorBorderColor = c.error,
        cursorColor = c.primary,
        focusedTextColor = c.text,
        unfocusedTextColor = c.text,
        focusedPlaceholderColor = c.text.copy(alpha = 0.45f),
        unfocusedPlaceholderColor = c.text.copy(alpha = 0.45f),
    )
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        enabled = enabled,
        readOnly = readOnly,
        textStyle = textStyle,
        label = label,
        placeholder = placeholder,
        leadingIcon = leadingIcon,
        trailingIcon = trailingIcon,
        prefix = prefix,
        suffix = suffix,
        supportingText = supportingText,
        isError = isError,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        singleLine = singleLine,
        maxLines = maxLines,
        minLines = minLines,
        shape = shape,
        colors = clayColors,
    )
}
