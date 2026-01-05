#version 300 es

precision highp float;

uniform vec4 u_color;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    float dist = length(v_uv);
    float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
    
    if (alpha < 0.01) {
        discard;
    }
    
    fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
