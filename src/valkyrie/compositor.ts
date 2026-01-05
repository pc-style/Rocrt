import type { Layer } from '../core/types';
import { BlendMode } from '../core/types';
import { TILE_SIZE } from '../core/config';

const BLEND_NORMAL_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_srcTexture;
uniform sampler2D u_dstTexture;
uniform float u_opacity;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    vec4 src = texture(u_srcTexture, v_uv);
    vec4 dst = texture(u_dstTexture, v_uv);
    
    float srcAlpha = src.a * u_opacity;
    float outAlpha = srcAlpha + dst.a * (1.0 - srcAlpha);
    
    vec3 outColor;
    if (outAlpha > 0.0) {
        outColor = (src.rgb * srcAlpha + dst.rgb * dst.a * (1.0 - srcAlpha)) / outAlpha;
    } else {
        outColor = vec3(0.0);
    }
    
    fragColor = vec4(outColor, outAlpha);
}`;

const BLEND_MULTIPLY_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_srcTexture;
uniform sampler2D u_dstTexture;
uniform float u_opacity;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    vec4 src = texture(u_srcTexture, v_uv);
    vec4 dst = texture(u_dstTexture, v_uv);
    
    vec3 multiplied = src.rgb * dst.rgb;
    float srcAlpha = src.a * u_opacity;
    float outAlpha = srcAlpha + dst.a * (1.0 - srcAlpha);
    
    vec3 outColor;
    if (outAlpha > 0.0) {
        outColor = (multiplied * srcAlpha + dst.rgb * dst.a * (1.0 - srcAlpha)) / outAlpha;
    } else {
        outColor = vec3(0.0);
    }
    
    fragColor = vec4(outColor, outAlpha);
}`;

const BLEND_SCREEN_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_srcTexture;
uniform sampler2D u_dstTexture;
uniform float u_opacity;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    vec4 src = texture(u_srcTexture, v_uv);
    vec4 dst = texture(u_dstTexture, v_uv);
    
    vec3 screened = 1.0 - (1.0 - src.rgb) * (1.0 - dst.rgb);
    float srcAlpha = src.a * u_opacity;
    float outAlpha = srcAlpha + dst.a * (1.0 - srcAlpha);
    
    vec3 outColor;
    if (outAlpha > 0.0) {
        outColor = (screened * srcAlpha + dst.rgb * dst.a * (1.0 - srcAlpha)) / outAlpha;
    } else {
        outColor = vec3(0.0);
    }
    
    fragColor = vec4(outColor, outAlpha);
}`;

export class Compositor {
  private gl: WebGL2RenderingContext | null = null;
  private programs: Map<BlendMode, WebGLProgram> = new Map();

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    
    this.programs.set(BlendMode.Normal, this.createBlendProgram(BLEND_NORMAL_FRAG));
    this.programs.set(BlendMode.Multiply, this.createBlendProgram(BLEND_MULTIPLY_FRAG));
    this.programs.set(BlendMode.Screen, this.createBlendProgram(BLEND_SCREEN_FRAG));
  }

  private createBlendProgram(fragSrc: string): WebGLProgram {
    if (!this.gl) throw new Error('GL not initialized');

    const vertSrc = `#version 300 es
    precision highp float;
    out vec2 v_uv;
    void main() {
        vec2 vertices[6] = vec2[6](
            vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
            vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0)
        );
        vec2 vertex = vertices[gl_VertexID];
        v_uv = vertex * 0.5 + 0.5;
        gl_Position = vec4(vertex, 0.0, 1.0);
    }`;

    const vertShader = this.compileShader(vertSrc, this.gl.VERTEX_SHADER)!;
    const fragShader = this.compileShader(fragSrc, this.gl.FRAGMENT_SHADER)!;

    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

    this.gl.deleteShader(vertShader);
    this.gl.deleteShader(fragShader);

    return program;
  }

  private compileShader(source: string, type: number): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  compositeLayers(_layers: Layer[], _canvasWidth: number, _canvasHeight: number): void {
    if (!this.gl) return;

    // For MVP, we'll use a simpler compositing approach
    // Full multi-layer compositing would require framebuffer ping-pong
    console.log('Compositing', _layers.length, 'layers at', _canvasWidth, 'x', _canvasHeight);
  }

  getBlendProgram(blendMode: BlendMode): WebGLProgram | undefined {
    return this.programs.get(blendMode);
  }

  getTileSize(): number {
    return TILE_SIZE;
  }

  dispose(): void {
    if (this.gl) {
      for (const program of this.programs.values()) {
        this.gl.deleteProgram(program);
      }
    }
    this.programs.clear();
  }
}
