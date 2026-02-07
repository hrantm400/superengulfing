import{j as e}from"./jsx-runtime-0DLF9kdB.js";import{T as f}from"./ThemeContext-Bq7VFISe.js";import{u as y,U as w,b as S}from"./LocaleContext-83TzI_2y.js";import{a as c,f as x,r as n,O as j}from"./index-QScjhSTK.js";import{j as L,k,_ as M,l,m as v,M as E,n as T,S as _}from"./components-CDq68o1-.js";import"./api-c0T8i5BA.js";/**
 * @remix-run/react v2.17.4
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */let a="positions";function b({getKey:t,...p}){let{isSpaMode:m}=L(),r=c(),u=x();k({getKey:t,storageKey:a});let d=n.useMemo(()=>{if(!t)return null;let s=t(r,u);return s!==r.key?s:null},[]);if(m)return null;let h=((s,g)=>{if(!window.history.state||!window.history.state.key){let o=Math.random().toString(32).slice(2);window.history.replaceState({key:o},"")}try{let i=JSON.parse(sessionStorage.getItem(s)||"{}")[g||window.history.state.key];typeof i=="number"&&window.scrollTo(0,i)}catch(o){console.error(o),sessionStorage.removeItem(s)}}).toString();return n.createElement("script",M({},p,{suppressHydrationWarning:!0,dangerouslySetInnerHTML:{__html:`(${h})(${l(JSON.stringify(a))}, ${l(JSON.stringify(d))})`}}))}function I(){const{locale:t}=y();return n.useEffect(()=>{document.documentElement.lang=t==="am"?"hy":"en"},[t]),null}const O=()=>{const{pathname:t}=c();return n.useEffect(()=>{window.scrollTo(0,0)},[t]),null},N="/assets/tailwind-C-BSWj-4.css",W=()=>[{rel:"stylesheet",href:N},{rel:"icon",type:"image/png",href:"/logo/se-favicon.png"},{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"},{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"},{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"},{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Noto+Sans+Armenian:wght@300;400;500;600;700&display=swap"}];function B(){return[{charset:"utf-8"},{name:"viewport",content:"width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5"},{title:"SuperEngulfing.io - Master the Liquidity Sweep"}]}const J={"@context":"https://schema.org","@graph":[{"@type":"Organization",name:"SuperEngulfing",url:"https://superengulfing.io",logo:"https://superengulfing.io/logo/superengulfing-logo-black.png",description:"Advanced educational tools and proprietary algorithms for financial market analysis. Master the liquidity sweep."},{"@type":"WebSite",name:"SuperEngulfing",url:"https://superengulfing.io",description:"Master the Liquidity Sweep. Institutional algos hunt stops—SuperEngulfing identifies the wick grab before the reversal."}]};function H(){return e.jsx("script",{dangerouslySetInnerHTML:{__html:`
          (function() {
            var theme = localStorage.getItem('theme');
            if (theme === 'light' || theme === 'dark') {
              document.documentElement.classList.toggle('dark', theme === 'dark');
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
              document.documentElement.classList.remove('dark');
            } else {
              document.documentElement.classList.add('dark');
            }
          })();
        `}})}function C(){const t=v();return e.jsxs("html",{lang:"en",className:"text-foreground font-display min-h-screen flex flex-col overflow-x-hidden selection:bg-primary selection:text-black",children:[e.jsxs("head",{children:[e.jsx(H,{}),e.jsx(E,{}),e.jsx(T,{}),typeof(t==null?void 0:t.env)<"u"&&e.jsx("script",{dangerouslySetInnerHTML:{__html:`window.ENV = ${JSON.stringify(t.env)};`}}),e.jsx("script",{type:"application/ld+json",dangerouslySetInnerHTML:{__html:JSON.stringify(J)}})]}),e.jsxs("body",{children:[e.jsx(f,{children:e.jsx(w,{children:e.jsxs(S,{children:[e.jsx(I,{}),e.jsx(O,{}),e.jsx(j,{})]})})}),e.jsx(b,{}),e.jsx(_,{})]})]})}export{C as default,W as links,B as meta};
