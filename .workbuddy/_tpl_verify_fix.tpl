sleep:9000
eval:(function(){var cv=cc.director.getScene().getChildByName('Canvas');var p=cv.getWorldPosition(new cc.Vec3());return JSON.stringify({canvas:[Math.round(p.x*10)/10,Math.round(p.y*10)/10]});})()
jsclick:(function(){var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();return [r.width/2,r.height*0.5];})()
sleep:2500
eval:(function(){var f=window.__tb.field.I;var b=f.bottles[0];var wp=b.node.getWorldPosition(new cc.Vec3());var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();var k=r.width/720;var cx=r.left+r.width/2-r.left,cy=r.height/2;var o={bottleWp:[Math.round(wp.x),Math.round(wp.y)]};o.clickAt=[Math.round(cx+wp.x*k),Math.round(cy-wp.y*k)];return JSON.stringify(o);})()
jsclick:(function(){var f=window.__tb.field.I;var b=f.bottles[0];var wp=b.node.getWorldPosition(new cc.Vec3());var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();var k=r.width/720;var cx=r.width/2,cy=r.height/2;return [Math.round(cx+wp.x*k),Math.round(cy-wp.y*k)];})()
sleep:2500
eval:(function(){var G=window.__tb.G;return JSON.stringify({flips:G.data.stats.flips||0,money:Math.round(G.data.money)});})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_v1_game.png
jsclick:(function(){var f=window.__tb.field.I;var b=f.bottles[0];if(!b)return [200,400];var wp=b.node.getWorldPosition(new cc.Vec3());var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();var k=r.width/720;return [Math.round(r.width/2+wp.x*k),Math.round(r.height/2-wp.y*k)];})()
sleep:2500
eval:(function(){var G=window.__tb.G;var f=window.__tb.field.I;return JSON.stringify({flips:G.data.stats.flips||0,bottles:f.bottles.length});})()
