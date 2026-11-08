// Positional-sfx unit check with a fake WebAudio context.
const nodes=[];
class N{constructor(k){this.k=k;this.gain={value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}};this.pan={value:0};this.frequency={value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}};nodes.push(this)}connect(x){return x}disconnect(){}start(){}stop(){}}
globalThis.AudioContext=class{constructor(){this.currentTime=0;this.sampleRate=100;this.destination=new N('d')}createDynamicsCompressor(){return new N('comp')}createGain(){return new N('gain')}createWaveShaper(){return new N('shaper')}createBuffer(){return {getChannelData:()=>new Float32Array(100)}}createOscillator(){return new N('osc')}createBiquadFilter(){return new N('bq')}createBufferSource(){return new N('src')}createStereoPanner(){return new N('pan')}resume(){}};
const ev={};globalThis.addEventListener=(t,f)=>{ev[t]=f};globalThis.localStorage={getItem:()=>null,setItem(){}};
const {audio}=await import('../js/audio.js');
ev.pointerdown?.();
const me={x:0,z:0,isPlayer:true,def:{role:'tank'}};audio.listener=()=>me;
const pans=()=>nodes.filter(n=>n.k==='pan').map(n=>n.pan.value);
await new Promise(r=>setTimeout(r,120));
const tests=[];const ok=(n,c)=>{console.log(c?'PASS':'FAIL',n);if(!c)process.exitCode=1};
const wait=()=>new Promise(r=>setTimeout(r,35));
const right={x:9,z:4,def:{role:'tank'}}; // along +right axis
audio.sfx('swing',right,undefined,right); let p=nodes.filter(n=>n.k==='pan');ok('right source pans right',p.length===1&&p[0].pan.value>0.3);
await wait();
const left={x:-9,z:-4,def:{role:'blaster'}};audio.sfx('swing',left,undefined,left);p=nodes.filter(n=>n.k==='pan');ok('left source pans left',p.at(-1).pan.value<-0.3);
await wait();
const far={x:60,z:0,def:{role:'tank'}};const n1=nodes.length;audio.sfx('swing',far,undefined,far);ok('far source silent (no nodes)',nodes.length===n1);
await wait();
const pc=nodes.filter(n=>n.k==='pan').length;audio.sfx('swing',me,undefined,me);ok('self centred (no panner)',nodes.filter(n=>n.k==='pan').length===pc);
await wait();
const near={x:2,z:0,def:{role:'tank'}},mid={x:30,z:0,def:{role:'tank'}};
audio.sfx('swing',near,undefined,near);const gN=nodes.filter(n=>n.k==='gain').at(-0-1);
const gains=()=>nodes.filter(n=>n.k==='gain');
await wait();
// compare spot gains: the first gain created per positional event holds attenuation
audio.sfx('swing',near,undefined,near);const gnear=nodes.find((n,i)=>n.k==='pan')&&nodes.filter(n=>n.k==='pan').at(-1);
await wait();const before=nodes.length;audio.sfx('poof',true,undefined,mid);
const g=nodes.slice(before).find(n=>n.k==='gain');
ok('mid distance attenuated (~0.18)',!!g&&Math.abs(g.gain.value-0.18)<0.03);
