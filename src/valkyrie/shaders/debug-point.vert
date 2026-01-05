#version 300 es

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_position;
uniform float u_size;

out vec2 v_uv;

void main() {
    vec2 vertices[6] = vec2[6](
        vec2(-1.0, -1.0),
        vec2( 1.0, -1.0),
        vec2(-1.0,  1.0),
        vec2(-1.0,  1.0),
        vec2( 1.0, -1.0),
        vec2( 1.0,  1.0)
    );
    
    vec2 vertex = vertices[gl_VertexID];
    v_uv = vertex;
    
    vec2 pos = u_position + vertex * u_size * 0.5;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    clipSpace.y = -clipSpace.y;
    
    gl_Position = vec4(clipSpace, 0.0, 1.0);
}
