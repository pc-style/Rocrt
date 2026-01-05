#version 300 es

precision highp float;

uniform sampler2D u_brushTexture;
uniform sampler2D u_layerTexture;
uniform vec4 u_brushColor;
uniform float u_opacity;

in vec2 v_uv;
out vec4 fragColor;

vec3 sRGBToLinear(vec3 srgb) {
    return pow(srgb, vec3(2.2));
}

vec3 linearToSRGB(vec3 linear) {
    return pow(linear, vec3(1.0 / 2.2));
}

void main() {
    vec4 brushSample = texture(u_brushTexture, v_uv);
    vec4 layerSample = texture(u_layerTexture, v_uv);
    
    vec3 brushLinear = sRGBToLinear(u_brushColor.rgb);
    vec3 layerLinear = layerSample.rgb;
    
    float srcAlpha = brushSample.a * u_brushColor.a * u_opacity;
    float dstAlpha = layerSample.a;
    float outAlpha = srcAlpha + dstAlpha * (1.0 - srcAlpha);
    
    vec3 outColor;
    if (outAlpha > 0.0) {
        outColor = (brushLinear * srcAlpha + layerLinear * dstAlpha * (1.0 - srcAlpha)) / outAlpha;
    } else {
        outColor = vec3(0.0);
    }
    
    fragColor = vec4(outColor, outAlpha);
}
