import {describe,it,expect,vi,afterEach} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {ChartPulse} from './ChartPulse'
afterEach(()=>vi.unstubAllGlobals())
const render=(enabled=true,reduced=false)=>{vi.stubGlobal('matchMedia',()=>({matches:reduced}));return renderToStaticMarkup(createElement('svg',{},createElement(ChartPulse,{path:'M 0 60 L 80 20 L 188 90',enabled})))}
describe('sales chart motion',()=>{
 it('sweeps one continuous glow along the full path every five seconds',()=>{const html=render();expect(html).toContain('d="M 0 60 L 80 20 L 188 90"');expect(html).toContain('pathLength="1000"');expect(html).toContain('attributeName="stroke-dashoffset"');expect(html).toContain('dur="5s"');expect(html.match(/class="chart-strand-glow"/g)).toHaveLength(1)})
 it('omits motion when disabled',()=>{expect(render(false)).toBe('<svg></svg>')})
 it('omits every animation when reduced motion is enabled',()=>{expect(render(true,true)).toBe('<svg></svg>')})
})
