sleep:9000
jsclick:(function(){var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();return [r.width/2,r.height*0.5];})()
sleep:2500
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var cr=gr.getChildByName('contentRoot');var ui=cr.getChildByName('shakeHolder').getChildByName('uiLayer');var hud=ui.getChildByName('hudRoot');var chip=hud.getChildByName('chipCoin');var hw=chip.getWorldPosition(new cc.Vec3());var cvw=gr.parent.getWorldPosition(new cc.Vec3());cr.getChildByName('bgLayer').active=false;ui.getChildByName('navRoot').active=false;var ar=ui.getChildByName('adRoot');if(ar)ar.active=false;cr.getChildByName('shakeHolder').getChildByName('worldLayer').active=false;gr.getChildByName('bootLayer').active=false;return JSON.stringify({cvW:[Math.round(cvw.x),Math.round(cvw.y)],chipW:[Math.round(hw.x),Math.round(hw.y)]});})()
sleep:1000
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_d13_hudonly.png
