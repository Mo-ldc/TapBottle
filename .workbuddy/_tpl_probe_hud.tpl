sleep:9000
jsclick:(function(){var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();return [r.width/2,r.height*0.5];})()
sleep:2500
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var hud=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer').getChildByName('hudRoot');hud.setPosition(0,100,0);return 'moved-to-center';})()
sleep:800
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_p1_hud_center.png
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var hud=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer').getChildByName('hudRoot');hud.layer=1073741824;function setL(n){n.layer=1073741824;for(var i=0;i<n.children.length;i++)setL(n.children[i]);}setL(hud);return 'layer-default';})()
sleep:800
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_p2_hud_layer.png
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var hud=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer').getChildByName('hudRoot');var ui=hud.parent;var ops=['cc.UIOpacity'];var o={};o.hudUIOp=hud.getComponent('cc.UIOpacity')?hud.getComponent('cc.UIOpacity').opacity:null;o.uiUIOp=ui.getComponent('cc.UIOpacity')?ui.getComponent('cc.UIOpacity').opacity:null;o.shakeOp=hud.parent.parent.getComponent('cc.UIOpacity')?hud.parent.parent.getComponent('cc.UIOpacity').opacity:null;o.crOp=gr.getChildByName('contentRoot').getComponent('cc.UIOpacity')?gr.getChildByName('contentRoot').getComponent('cc.UIOpacity').opacity:null;o.grOp=gr.getComponent('cc.UIOpacity')?gr.getComponent('cc.UIOpacity').opacity:null;o.hudSibling=hud.getSiblingIndex();o.uiKids=ui.children.map(function(c){return c.name;}).join(',');return JSON.stringify(o);})()
