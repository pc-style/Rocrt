#version 300 es

precision highp float;

uniform sampler2D u_tileTexture;
uniform float u_opacity;

in vec2 v_uv;
out vec4 fragColor;

vec3 linearToSRGB(vec3 linear) {
    return pow(linear, vec3(1.0 / 2.2));
}

void main() {
    vec4 tileColor = texture(u_tileTexture, v_uv);
    
    vec3 srgbColor = linearToSRGB(tileColor.rgb);
    float alpha = tileColor.a * u_opacity;
    
    fragColor = vec4(srgbColor, alpha);
}
