import { ComponentChildren, JSX } from 'preact';

interface IconButtonProps {
    icon: ComponentChildren;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title?: string;
    size?: number;
    variant?: 'default' | 'primary' | 'danger' | 'ghost';
    style?: JSX.CSSProperties;
}

const variantStyles: Record<NonNullable<IconButtonProps['variant']>, { bg: string; activeBg: string; color: string; activeColor: string }> = {
    default: {
        bg: 'rgba(50, 50, 55, 0.9)',
        activeBg: 'rgba(90, 100, 120, 0.95)',
        color: 'rgba(180, 180, 190, 1)',
        activeColor: '#fff',
    },
    primary: {
        bg: 'rgba(60, 80, 110, 0.9)',
        activeBg: 'rgba(80, 120, 180, 0.95)',
        color: 'rgba(200, 210, 230, 1)',
        activeColor: '#fff',
    },
    danger: {
        bg: 'rgba(90, 50, 50, 0.9)',
        activeBg: 'rgba(160, 60, 60, 0.95)',
        color: 'rgba(240, 180, 180, 1)',
        activeColor: '#fff',
    },
    ghost: {
        bg: 'transparent',
        activeBg: 'rgba(80, 80, 90, 0.7)',
        color: 'rgba(150, 150, 160, 1)',
        activeColor: '#fff',
    },
};

export function IconButton({
    icon,
    onClick,
    active = false,
    disabled = false,
    title,
    size = 44,
    variant = 'default',
    style,
}: IconButtonProps) {
    const vs = variantStyles[variant];

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '10px',
                border: 'none',
                background: active ? vs.activeBg : vs.bg,
                color: active ? vs.activeColor : vs.color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease, transform 0.1s ease',
                ...style,
            }}
        >
            {icon}
        </button>
    );
}
