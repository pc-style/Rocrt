import { TILE_SIZE } from '../core/config';
import type { TileManager, Tile } from './tile-manager';

const VERT_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_tileOffset;
uniform float u_tileSize;
uniform float u_zoom;
uniform vec2 u_pan;

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
    vec2 scaledPos = (tilePos - center + u_pan) * u_zoom + center;
    
    vec2 clipSpace = (scaledPos / u_resolution) * 2.0 - 1.0;
    clipSpace.y = -clipSpace.y;
    
    gl_Position = vec4(clipSpace, 0.0, 1.0);
}`;

const FRAG_SHADER = `#version 300 es
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
    fragColor = vec4(srgbColor * alpha, alpha);
}`;

export class TileRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms: {
    resolution: WebGLUniformLocation | null;
    tileOffset: WebGLUniformLocation | null;
    tileSize: WebGLUniformLocation | null;
    zoom: WebGLUniformLocation | null;
    pan: WebGLUniformLocation | null;
    tileTexture: WebGLUniformLocation | null;
    opacity: WebGLUniformLocation | null;
  } = {
    resolution: null,
    tileOffset: null,
    tileSize: null,
    zoom: null,
    pan: null,
    tileTexture: null,
    opacity: null,
  };

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.program = this.createProgram(VERT_SHADER, FRAG_SHADER);

    if (!this.program) {
      console.error('Failed to create tile shader program');
      return;
    }

    this.uniforms.resolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.uniforms.tileOffset = gl.getUniformLocation(this.program, 'u_tileOffset');
    this.uniforms.tileSize = gl.getUniformLocation(this.program, 'u_tileSize');
    this.uniforms.zoom = gl.getUniformLocation(this.program, 'u_zoom');
    this.uniforms.pan = gl.getUniformLocation(this.program, 'u_pan');
    this.uniforms.tileTexture = gl.getUniformLocation(this.program, 'u_tileTexture');
    this.uniforms.opacity = gl.getUniformLocation(this.program, 'u_opacity');

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
      console.error('Shader link error:', this.gl.getProgramInfoLog(program));
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

  renderTiles(tileManager: TileManager, zoom: number, panX: number, panY: number, opacity: number = 1.0): void {
    if (!this.gl || !this.program || !this.vao) return;

    const tiles = tileManager.getAllTiles();
    if (tiles.length === 0) return;

    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

    const canvas = this.gl.canvas as HTMLCanvasElement;
    this.gl.uniform2f(this.uniforms.resolution, canvas.width, canvas.height);
    this.gl.uniform1f(this.uniforms.tileSize, TILE_SIZE);
    this.gl.uniform1f(this.uniforms.zoom, zoom);
    this.gl.uniform2f(this.uniforms.pan, panX, panY);
    this.gl.uniform1f(this.uniforms.opacity, opacity);
    this.gl.uniform1i(this.uniforms.tileTexture, 0);

    for (const tile of tiles) {
      this.renderTile(tile);
    }

    this.gl.disable(this.gl.BLEND);
    this.gl.bindVertexArray(null);
  }

  private renderTile(tile: Tile): void {
    if (!this.gl || !tile.gpuTexture) return;

    const offsetX = tile.gridX * TILE_SIZE;
    const offsetY = tile.gridY * TILE_SIZE;

    this.gl.uniform2f(this.uniforms.tileOffset, offsetX, offsetY);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tile.gpuTexture);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
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
