sleep:9000
jsclick:(function(){var c=document.getElementById('GameCanvas');var r=c.getBoundingClientRect();return [r.width/2,r.height*0.5];})()
sleep:2500
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var hud=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer').getChildByName('hudRoot');var out=[];function scan(n,d){if(d>2)return;var cs=[];for(var i=0;i<n.components.length;i++){var c=n.components[i];cs.push(c.__classname__?c.__classname__.split('.').pop():'?'+(c.enabled===false?':OFF':''));}out.push(n.name+'['+cs.join(',')+']'+(n.components.length===0?'(NO-COMP)':''));for(var j=0;j<n.children.length;j++)scan(n.children[j],d+1);}scan(hud,0);return out.join(' ; ').substring(0,1100);})()
eval:(function(){var gr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot');var ui=gr.getChildByName('contentRoot').getChildByName('shakeHolder').getChildByName('uiLayer');var n=new cc.Node();n.layer=33554432;n.setPosition(0,300,0);var sp=n.addComponent(cc.Sprite);sp.spriteFrame=window.__tb.res.I.sf('ui/coin');ui.addChild(n);return 'test-sprite-added';})()
sleep:800
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_p3_test_sprite.png
