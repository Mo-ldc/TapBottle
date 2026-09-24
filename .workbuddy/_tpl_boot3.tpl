sleep:5200
eval:(function(){var bl=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot').getChildByName('bootLayer');var bc=bl.getComponent('Boot');var ctl=bl.getChildByName('BootCtl');ctl.getChildByName('TitleRoot').active=false;var lr=ctl.getChildByName('LoadingRoot');lr.active=true;lr.getComponent('cc.UIOpacity').opacity=255;bc.shown=0.388;bc.target=0.388;bc.setFill(0.388);return 'FORCED 0.388';})()
sleep:1400
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_m_bar388.png
eval:(function(){var bl=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot').getChildByName('bootLayer');var ctl=bl.getChildByName('BootCtl');ctl.getChildByName('LoadingRoot').active=false;ctl.getChildByName('TitleRoot').active=true;return 'TITLE';})()
sleep:900
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_m_title2.png
eval:(function(x,y){var c=document.getElementById('GameCanvas');if(!c)return 'NO_CANVAS';var r=c.getBoundingClientRect();var cx=r.left+x,cy=r.top+y;var p={bubbles:true,cancelable:true,clientX:cx,clientY:cy,pointerId:1,pointerType:'mouse',button:0,buttons:1,isPrimary:true};try{c.dispatchEvent(new PointerEvent('pointerdown',p));window.dispatchEvent(new PointerEvent('pointerup',p));}catch(e){return 'PE_ERR:'+e;}try{c.dispatchEvent(new MouseEvent('mousedown',p));window.dispatchEvent(new MouseEvent('mouseup',p));}catch(e){return 'ME_ERR:'+e;}return 'FIRED';})(360,900)
sleep:2600
eval:(function(){var s=cc.director.getScene();var gr=s.getChildByName('Canvas').getChildByName('GameRoot');var bl=gr.getChildByName('bootLayer');var f=window.__tb.field.I;var o={bootGone:!bl,bottles:f.bottles.length};if(f.bottles[0]){var b=f.bottles[0];o.hasArt=!!(b.art&&b.art.isValid);o.scale=Math.round(b.node.scale.x*1000)/1000;o.angle=b.node.angle;o.pos=[Math.round(b.node.position.x),Math.round(b.node.position.y)];}return JSON.stringify(o);})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_m_game.png
eval:(function(){var f=window.__tb.field.I;var b=f.bottles[0];if(!b)return [360,600];var p=b.node.position;return [Math.round(360+p.x),Math.round(640-p.y)];})()
sleep:1600
eval:(function(){var f=window.__tb.field.I;var G=window.__tb.G;var o={bottles:f.bottles.length,caps:G.data.caps,money:Math.round(G.data.money)};return JSON.stringify(o);})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_m_play.png
