import type { Point2D, Color } from '../core/types';

const VERT_SHADER = `#version 300 es
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
}`;

const FRAG_SHADER = `#version 300 es
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
}`;

export class DebugRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms: {
    resolution: WebGLUniformLocation | null;
    position: WebGLUniformLocation | null;
    size: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
  } = { resolution: null, position: null, size: null, color: null };

  private points: Array<{ position: Point2D; size: number; color: Color }> = [];

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.program = this.createProgram(VERT_SHADER, FRAG_SHADER);
    
    if (!this.program) {
      console.error('Failed to create debug shader program');
      return;
    }

    this.uniforms.resolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.uniforms.position = gl.getUniformLocation(this.program, 'u_position');
    this.uniforms.size = gl.getUniformLocation(this.program, 'u_size');
    this.uniforms.color = gl.getUniformLocation(this.program, 'u_color');

    this.vao = gl.createVertexArray();
  }

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram | null {
    if (!this.gl) return null;

    const vertShader = this.compileShader(vertSrc, this.gl.VERTEX_SHADER);
    const fragShader = this.compileShader(fragSrc, this.gl.FRAGMENT_SHADER);

    if (!vertShader || !fragShader) return null;

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Shader program link error:', this.gl.getProgramInfoLog(program));
      return null;
    }

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

  addPoint(position: Point2D, size: number = 20, color: Color = { r: 255, g: 100, b: 100, a: 255 }): void {
    this.points.push({ position, size, color });
    if (this.points.length > 1000) {
      this.points.shift();
    }
  }

  clearPoints(): void {
    this.points = [];
  }

  render(): void {
    if (!this.gl || !this.program || !this.vao || this.points.length === 0) return;

    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    const canvas = this.gl.canvas as HTMLCanvasElement;
    this.gl.uniform2f(this.uniforms.resolution, canvas.width, canvas.height);

    for (const point of this.points) {
      this.gl.uniform2f(this.uniforms.position, point.position.x, point.position.y);
      this.gl.uniform1f(this.uniforms.size, point.size);
      this.gl.uniform4f(
        this.uniforms.color,
        point.color.r / 255,
        point.color.g / 255,
        point.color.b / 255,
        point.color.a / 255
      );
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    this.gl.disable(this.gl.BLEND);
    this.gl.bindVertexArray(null);
  }

  dispose(): void {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
    if (this.gl && this.vao) {
      this.gl.deleteVertexArray(this.vao);
    }
    this.program = null;
    this.vao = null;
    this.gl = null;
  }
}
