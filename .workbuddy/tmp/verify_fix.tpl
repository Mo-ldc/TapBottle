eval:JSON.stringify({proj:cc.director.getScene().getComponentsInChildren('cc.Camera')[0].projection,vis:cc.view.getVisibleSize(),money:window.__tb?__tb.G.money:null,flips:window.__tb?__tb.G.flips:null})
jsdrag:[window.innerWidth*0.5,window.innerHeight*0.8,window.innerWidth*0.5,window.innerHeight*0.7]
sleep:2000
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/tmp/fix_portrait.png
jsclick:(function(){var b=__tb.field.I.bottles[0].node;var k=window.innerHeight/cc.view.getVisibleSize().height;var wp=b.worldPosition;return [wp.x*k,window.innerHeight-wp.y*k]})()
sleep:2500
eval:JSON.stringify({money:__tb.G.money,flips:__tb.G.flips})
