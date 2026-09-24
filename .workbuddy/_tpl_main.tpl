sleep:11000
eval:(function(){var s=cc.director.getScene();var cv=s.getChildByName('Canvas');var gr=cv.getChildByName('GameRoot');var bl=gr.getChildByName('bootLayer');var bc=bl?(bl.getComponent('Boot')||bl.getComponentInChildren('Boot')):null;var f=window.__tb&&window.__tb.field&&window.__tb.field.I;return JSON.stringify({scene:s.name,bootReady:bc?bc.ready:-1,bootShown:bc?Math.round(bc.shown*100)/100:-1,bottles:f&&f.bottles?f.bottles.length:-1});})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_m_title.png
eval:(function(x,y){var c=document.getElementById('GameCanvas');if(!c)return 'NO_CANVAS';var r=c.getBoundingClientRect();var cx=r.left+x,cy=r.top+y;var p={bubbles:true,cancelable:true,clientX:cx,clientY:cy,pointerId:1,pointerType:'mouse',button:0,buttons:1,isPrimary:true};try{c.dispatchEvent(new PointerEvent('pointerdown',p));window.dispatchEvent(new PointerEvent('pointerup',p));}catch(e){return 'PE_ERR:'+e;}try{c.dispatchEvent(new MouseEvent('mousedown',p));window.dispatchEvent(new MouseEvent('mouseup',p));}catch(e){return 'ME_ERR:'+e;}return 'FIRED';})(360,900)
sleep:3500
eval:(function(){var s=cc.director.getScene();var gr=s.getChildByName('Canvas').getChildByName('GameRoot');var bl=gr&&gr.getChildByName('bootLayer');var f=window.__tb.field.I;var o={bootGone:!bl,bottles:f.bottles.length};if(f.bottles[0]){var b=f.bottles[0];o.tier=b.tier;o.hasArt=!!(b.art&&b.art.isValid);o.scale=Math.round(b.node.scale.x*1000)/1000;o.angle=b.node.angle;o.pos=[Math.round(b.node.position.x),Math.round(b.node.position.y)];}o.money=Math.round(window.__tb.G.data.money);return JSON.stringify(o);})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_m_game.png
jsclick:(function(){var f=window.__tb.field.I;var b=f.bottles[0];if(!b)return [360,600];var p=b.node.position;return [Math.round(360+p.x),Math.round(640-p.y)];})()
sleep:1500
jsclick:(function(){var f=window.__tb.field.I;var b=f.bottles[0];if(!b)return [360,600];var p=b.node.position;return [Math.round(360+p.x),Math.round(640-p.y)];})()
sleep:1800
jsclick:(function(){var f=window.__tb.field.I;var b=f.bottles[0];if(!b)return [360,600];var p=b.node.position;return [Math.round(360+p.x),Math.round(640-p.y)];})()
sleep:2200
eval:(function(){var f=window.__tb.field.I;var G=window.__tb.G;var o={bottles:f.bottles.length,caps:G.data.caps,money:Math.round(G.data.money),flips:G.data.stats.flips!==undefined?G.data.stats.flips:-1};var busy=0;for(var i=0;i<f.bottles.length;i++){if(f.bottles[i].busy)busy++;}o.busy=busy;return JSON.stringify(o);})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_m_play.png
