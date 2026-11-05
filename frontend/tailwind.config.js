export default {darkMode:'class',content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{
colors:{ivory:'#faf7f0',surface:'rgb(var(--surface) / <alpha-value>)','surface-2':'rgb(var(--surface-2) / <alpha-value>)',line:'rgb(var(--line) / <alpha-value>)',navy:'#0f172a',teal:'rgb(var(--accent) / <alpha-value>)',brand2:'rgb(var(--accent2) / <alpha-value>)'},
fontFamily:{serif:['var(--font-head)'],sans:['var(--font-body)'],hand:['var(--font-hand)']},
keyframes:{
 fadeIn:{from:{opacity:0},to:{opacity:1}},
 fadeUp:{from:{opacity:0,transform:'translateY(14px)'},to:{opacity:1,transform:'none'}},
 breathe:{'0%,100%':{transform:'scale(.82)',opacity:.45},'50%':{transform:'scale(1)',opacity:.9}},
 pop:{'0%':{transform:'scale(.6)',opacity:0},'60%':{transform:'scale(1.08)',opacity:1},'100%':{transform:'scale(1)'}},
 slideDown:{from:{opacity:0,transform:'translateY(-8px)'},to:{opacity:1,transform:'none'}},
 float:{'0%,100%':{transform:'translateY(0)'},'50%':{transform:'translateY(-6px)'}},
 shimmer:{from:{backgroundPosition:'200% 0'},to:{backgroundPosition:'-200% 0'}},
 ping2:{'0%':{transform:'scale(1)',opacity:.55},'100%':{transform:'scale(1.9)',opacity:0}}},
animation:{fadeIn:'fadeIn .25s ease both',slideDown:'slideDown .25s ease both',fadeUp:'fadeUp .6s ease both',breathe:'breathe 6s ease-in-out infinite',pop:'pop .5s ease both',float:'float 4s ease-in-out infinite',shimmer:'shimmer 3s linear infinite',ping2:'ping2 1.8s ease-out infinite'}}}}
