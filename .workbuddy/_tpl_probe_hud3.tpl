sleep:9000
jsclick:(function(){var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();return [r.width/2,r.height*0.5];})()
sleep:2500
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var hud=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer').getChildByName('hudRoot');hud.active=false;return 'off';})()
sleep:300
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var hud=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer').getChildByName('hudRoot');hud.active=true;return 're-on';})()
sleep:800
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_p5_reon.png
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var ui=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer');var hud=ui.getChildByName('hudRoot');var chip=hud.getChildByName('chipCoin');chip.parent=null;ui.addChild(chip);chip.setPosition(0,0,0);chip.setScale(1,1,1);return 'reparented-chip';})()
sleep:800
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_p6_chip_center.png
