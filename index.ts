import * as wgsl from './src';

const shader = `
struct ViewUniforms {
    viewProjection: mat4x4<f32>
}

struct ModelUniforms {
    model: mat4x4<f32>,
    color: vec4<f32>,
    intensity: f32
}

@binding(0) @group(0) var<uniform> viewUniforms: ViewUniforms;
@binding(1) @group(0) var<uniform> modelUniforms: ModelUniforms;
@binding(2) @group(0) var u_sampler: sampler;
@binding(3) @group(0) var u_texture: texture_2d<f32>;

struct VertexInput {
    @location(0) a_position: vec3<f32>,
    @location(1) a_normal: vec3<f32>,
    @location(2) a_color: vec4<f32>,
    @location(3) a_uv: vec2<f32>
}

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) v_position: vec4<f32>,
    @location(1) v_normal: vec3<f32>,
    @location(2) v_color: vec4<f32>,
    @location(3) v_uv: vec2<f32>
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.Position = viewUniforms.viewProjection * modelUniforms.model * vec4<f32>(input.a_position, 1.0);
    output.v_position = output.Position;
    output.v_normal = input.a_normal;
    output.v_color = input.a_color * modelUniforms.color * modelUniforms.intensity;
    output.v_uv = input.a_uv;
    return output;
}`;

const shadercode = document.getElementById('shader') as HTMLTextAreaElement;
shadercode.value = shader;

const shaderInfo = document.getElementById('shader_info') as HTMLDivElement;

function getTypeName(type)
{
    let name = type.name;
    if (type.format)
    { name += `&lt;${type.format.name}&gt;`; }

    return name;
}

function parse()
{
    let info = '';
    const reflect = new wgsl.WgslReflect(shadercode.value);

    info += '<b>Entry Points</b>';
    info += '<ul>';
    for (const s in reflect.entry)
    {
        for (const e of reflect.entry[s])
        {
            info += `<li><b>${e.name}</b>: ${s}</li>`;
            if (e.inputs.length)
            {
                info += '<ul>';
                info += '<li><b>Inputs</b></li>';
                info += '<ul>';
                for (const ei of e.inputs)
                {
                    info += `<li><b>${ei.name}</b>: <b>${getTypeName(ei.type)}</b>  location:<b> ${ei.location}</b></li>`;
                }
                info += '</ul>';
                info += '</ul>';
            }
        }
    }
    info += '</ul>';

    info += `<b>Uniforms</b><p>`;
    info += '<ul>';
    for (const s of reflect.uniforms)
    {
        info += `<li><b>${s.name}</b>: <b>${s.type.name}</b></li>`;

        const bufferInfo = reflect.getUniformBufferInfo(s) as wgsl.BufferInfo;

        info += '<ul>';
        info += `<li><b>Buffer Size:</b> ${bufferInfo.size}</li>`;
        info += `<li><b>Bind Group:</b> ${bufferInfo.group}</li>`;
        info += `<li><b>Bind Index:</b> ${bufferInfo.binding}</li>`;
        info += `<li><b>Members:</b></li>`;
        info += '<ul>';
        for (const m in bufferInfo.members)
        {
            info += `<li><b>${bufferInfo.members[m].name}</b> : <b>${getTypeName(bufferInfo.members[m].type)}</b></li>`;
            info += '<ul>';
            info += `<li><b>Offset:</b>${bufferInfo.members[m].offset}</li>`;
            info += `<li><b>Size:</b>${bufferInfo.members[m].size}</li>`;
            info += '</ul>';
        }
        info += '</ul>';
        info += '</ul>';
    }
    info += '</ul>';

    shaderInfo.innerHTML = info;
}
parse();

const parseButton = document.getElementById('parse') as HTMLButtonElement;
parseButton.addEventListener('click', function ()
{
    parse();
});
