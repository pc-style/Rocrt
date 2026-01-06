import type { Layer } from '../core/types';
import { BlendMode } from '../core/types';
import { TILE_SIZE } from '../core/config';

// shared vertex shader for fullscreen quad
const FULLSCREEN_VERT = `#version 300 es
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

// normal blend with porter-duff over
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

// overlay blend mode
const BLEND_OVERLAY_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_srcTexture;
uniform sampler2D u_dstTexture;
uniform float u_opacity;

in vec2 v_uv;
out vec4 fragColor;

vec3 overlay(vec3 base, vec3 blend) {
    return mix(
        2.0 * base * blend,
        1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
        step(0.5, base)
    );
}

void main() {
    vec4 src = texture(u_srcTexture, v_uv);
    vec4 dst = texture(u_dstTexture, v_uv);

    vec3 blended = overlay(dst.rgb, src.rgb);
    float srcAlpha = src.a * u_opacity;
    float outAlpha = srcAlpha + dst.a * (1.0 - srcAlpha);

    vec3 outColor;
    if (outAlpha > 0.0) {
        outColor = (blended * srcAlpha + dst.rgb * dst.a * (1.0 - srcAlpha)) / outAlpha;
    } else {
        outColor = vec3(0.0);
    }

    fragColor = vec4(outColor, outAlpha);
}`;

// simple copy shader for final output
const COPY_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
in vec2 v_uv;
out vec4 fragColor;

void main() {
    fragColor = texture(u_texture, v_uv);
}`;

// ping-pong framebuffer for multi-layer compositing
interface CompositeBuffer {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
}

export class Compositor {
  private gl: WebGL2RenderingContext | null = null;
  private programs: Map<BlendMode, WebGLProgram> = new Map();
  private copyProgram: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;

  // ping-pong buffers for layer compositing
  private bufferA: CompositeBuffer | null = null;
  private bufferB: CompositeBuffer | null = null;
  private bufferWidth: number = 0;
  private bufferHeight: number = 0;

  // uniform locations cache
  private uniformCache: Map<WebGLProgram, {
    srcTexture: WebGLUniformLocation | null;
    dstTexture: WebGLUniformLocation | null;
    opacity: WebGLUniformLocation | null;
  }> = new Map();

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;

    // compile shared vertex shader once
    this.vertexShader = this.compileShader(FULLSCREEN_VERT, gl.VERTEX_SHADER);

    // create blend programs
    this.programs.set(BlendMode.Normal, this.createBlendProgram(BLEND_NORMAL_FRAG));
    this.programs.set(BlendMode.Multiply, this.createBlendProgram(BLEND_MULTIPLY_FRAG));
    this.programs.set(BlendMode.Screen, this.createBlendProgram(BLEND_SCREEN_FRAG));
    this.programs.set(BlendMode.Overlay, this.createBlendProgram(BLEND_OVERLAY_FRAG));

    // create copy program for final output
    this.copyProgram = this.createCopyProgram();
  }

  private createBlendProgram(fragSrc: string): WebGLProgram {
    if (!this.gl || !this.vertexShader) throw new Error('GL not initialized');

    const fragShader = this.compileShader(fragSrc, this.gl.FRAGMENT_SHADER)!;

    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, this.vertexShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(program));
    }

    this.gl.deleteShader(fragShader);

    // cache uniform locations
    this.uniformCache.set(program, {
      srcTexture: this.gl.getUniformLocation(program, 'u_srcTexture'),
      dstTexture: this.gl.getUniformLocation(program, 'u_dstTexture'),
      opacity: this.gl.getUniformLocation(program, 'u_opacity'),
    });

    return program;
  }

  private createCopyProgram(): WebGLProgram {
    if (!this.gl || !this.vertexShader) throw new Error('GL not initialized');

    const fragShader = this.compileShader(COPY_FRAG, this.gl.FRAGMENT_SHADER)!;

    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, this.vertexShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

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

  // ensure ping-pong buffers are allocated and sized correctly
  private ensureBuffers(width: number, height: number): void {
    if (!this.gl) return;

    if (this.bufferWidth === width && this.bufferHeight === height && this.bufferA && this.bufferB) {
      return;
    }

    // clean up old buffers
    this.disposeBuffers();

    this.bufferA = this.createCompositeBuffer(width, height);
    this.bufferB = this.createCompositeBuffer(width, height);
    this.bufferWidth = width;
    this.bufferHeight = height;
  }

  private createCompositeBuffer(width: number, height: number): CompositeBuffer {
    const gl = this.gl!;

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer incomplete:', status);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { framebuffer, texture };
  }

  private disposeBuffers(): void {
    if (!this.gl) return;

    if (this.bufferA) {
      this.gl.deleteFramebuffer(this.bufferA.framebuffer);
      this.gl.deleteTexture(this.bufferA.texture);
      this.bufferA = null;
    }

    if (this.bufferB) {
      this.gl.deleteFramebuffer(this.bufferB.framebuffer);
      this.gl.deleteTexture(this.bufferB.texture);
      this.bufferB = null;
    }
  }

  // composite multiple layers using ping-pong framebuffers
  compositeLayers(layers: Layer[], canvasWidth: number, canvasHeight: number): WebGLTexture | null {
    if (!this.gl || layers.length === 0) return null;

    this.ensureBuffers(canvasWidth, canvasHeight);
    if (!this.bufferA || !this.bufferB) return null;

    const gl = this.gl;
    const visibleLayers = layers.filter((l) => l.visible && l.opacity > 0);

    if (visibleLayers.length === 0) return null;

    // sort by z-index (bottom to top)
    visibleLayers.sort((a, b) => a.zIndex - b.zIndex);

    // start with cleared buffer A
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bufferA.framebuffer);
    gl.viewport(0, 0, canvasWidth, canvasHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let readBuffer = this.bufferA;
    let writeBuffer = this.bufferB;

    // composite each layer
    for (let i = 0; i < visibleLayers.length; i++) {
      const layer = visibleLayers[i]!;
      const layerTexture = this.getLayerTexture(layer);

      if (!layerTexture) continue;

      const program = this.programs.get(layer.blendMode) ?? this.programs.get(BlendMode.Normal);
      if (!program) continue;

      const uniforms = this.uniformCache.get(program);
      if (!uniforms) continue;

      // render to write buffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeBuffer.framebuffer);
      gl.viewport(0, 0, canvasWidth, canvasHeight);

      gl.useProgram(program);

      // bind source (layer) texture to unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, layerTexture);
      gl.uniform1i(uniforms.srcTexture, 0);

      // bind destination (accumulated) texture to unit 1
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, readBuffer.texture);
      gl.uniform1i(uniforms.dstTexture, 1);

      gl.uniform1f(uniforms.opacity, layer.opacity);

      // draw fullscreen quad
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // swap buffers for next iteration
      const temp = readBuffer;
      readBuffer = writeBuffer;
      writeBuffer = temp;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // return the texture with the final composite
    return readBuffer.texture;
  }

  // render a single layer texture blended onto another
  blendLayer(
    srcTexture: WebGLTexture,
    dstTexture: WebGLTexture,
    blendMode: BlendMode,
    opacity: number,
    targetFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number
  ): void {
    if (!this.gl) return;

    const gl = this.gl;
    const program = this.programs.get(blendMode) ?? this.programs.get(BlendMode.Normal);
    if (!program) return;

    const uniforms = this.uniformCache.get(program);
    if (!uniforms) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);

    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTexture);
    gl.uniform1i(uniforms.srcTexture, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, dstTexture);
    gl.uniform1i(uniforms.dstTexture, 1);

    gl.uniform1f(uniforms.opacity, opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // copy a texture to the screen or another framebuffer
  copyToScreen(texture: WebGLTexture, width: number, height: number): void {
    if (!this.gl || !this.copyProgram) return;

    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);

    gl.useProgram(this.copyProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(this.copyProgram, 'u_texture'), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // placeholder - in real impl this would composite layer tiles into a single texture
  private getLayerTexture(_layer: Layer): WebGLTexture | null {
    // DEPRECATED: Layer tile compositing is now handled by SkiaRenderer
    // for now returns null - real implementation would iterate layer.tileData
    // and composite all tiles into a layer-sized texture
    return null;
  }

  getBlendProgram(blendMode: BlendMode): WebGLProgram | undefined {
    return this.programs.get(blendMode);
  }

  getTileSize(): number {
    return TILE_SIZE;
  }

  dispose(): void {
    this.disposeBuffers();

    if (this.gl) {
      for (const program of this.programs.values()) {
        this.gl.deleteProgram(program);
      }

      if (this.copyProgram) {
        this.gl.deleteProgram(this.copyProgram);
      }

      if (this.vertexShader) {
        this.gl.deleteShader(this.vertexShader);
      }
    }

    this.programs.clear();
    this.uniformCache.clear();
  }
}
