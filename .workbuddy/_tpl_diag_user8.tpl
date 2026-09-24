sleep:9000
jsclick:(function(){var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();return [r.width/2,r.height*0.5];})()
sleep:2500
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var cr=gr.getChildByName('contentRoot');var bg=cr.getChildByName('bgLayer');var hud=cr.getChildByName('shakeHolder').getChildByName('uiLayer').getChildByName('hudRoot');var out=[];for(var i=0;i<hud.children.length;i++){var n=hud.children[i];var sp=n.getComponent('cc.Sprite');var lb=n.getComponent('cc.Label');out.push(n.name+'|pos='+Math.round(n.position.x)+','+Math.round(n.position.y)+'|act='+n.activeInHierarchy+(sp?'|sf='+(sp.spriteFrame?'Y':'N'):'')+(lb?'|txt='+JSON.stringify(lb.string):''));}var o={hudPos:[Math.round(hud.position.x),Math.round(hud.position.y)],uiPos:[Math.round(hud.parent.position.x),Math.round(hud.parent.position.y)],crPos:[Math.round(cr.position.x),Math.round(cr.position.y)],crScale:Math.round(cr.scale.x*1000)/1000,bgKids:bg.children.length,hud:out.join(' ; ')};bg.active=false;return JSON.stringify(o);})()
sleep:1200
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_d10_nobg.png
