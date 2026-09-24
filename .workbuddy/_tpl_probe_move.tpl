sleep:9000
jsclick:(function(){var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();return [r.width/2,r.height*0.5];})()
sleep:2500
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var ui=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer');var chip=ui.getChildByName('chipCoin')||ui.getChildByName('hudRoot');chip.setPosition(0,300,0);return 'chip-moved-300';})()
sleep:800
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_p7_chip_moved.png
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var ui=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer');var nav=ui.getChildByName('navRoot');nav.setPosition(0,200,0);return 'nav-moved-200';})()
sleep:800
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_p8_nav_moved.png
