#version 300 es

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_tileOffset;
uniform float u_tileSize;
uniform float u_zoom;
uniform vec2 u_pan;
uniform float u_rotation;

out vec2 v_uv;

void main() {
    vec2 vertices[6] = vec2[6](
        vec2(0.0, 0.0),
        vec2(1.0, 0.0),
        vec2(0.0, 1.0),
        vec2(0.0, 1.0),
        vec2(1.0, 0.0),
        vec2(1.0, 1.0)
    );
    
    vec2 vertex = vertices[gl_VertexID];
    v_uv = vertex;
    
    vec2 tilePos = u_tileOffset + vertex * u_tileSize;
    
    vec2 center = u_resolution * 0.5;
    vec2 centeredPos = tilePos - center + u_pan;
    
    float cosR = cos(u_rotation);
    float sinR = sin(u_rotation);
    vec2 rotatedPos = vec2(
        centeredPos.x * cosR - centeredPos.y * sinR,
        centeredPos.x * sinR + centeredPos.y * cosR
    );
    
    vec2 scaledPos = rotatedPos * u_zoom + center;
    
    vec2 clipSpace = (scaledPos / u_resolution) * 2.0 - 1.0;
    clipSpace.y = -clipSpace.y;
    
    gl_Position = vec4(clipSpace, 0.0, 1.0);
}
