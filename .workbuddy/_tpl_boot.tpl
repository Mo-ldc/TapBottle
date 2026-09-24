sleep:10000
eval:(function(){var s=cc.director.getScene();if(!s)return 'NO_SCENE';var o={scene:s.name,bootReady:false,titleOn:false,err:[]};(function f(n,d){if(d>3)return;for(var i=0;i<n.children.length;i++){var c=n.children[i];o.err.push(new Array(d+1).join('.')+c.name+(c.active?'':'[off]'));f(c,d+1);}})(s,0);var cv=s.getChildByName('Canvas');var bt=cv&&cv.getChildByName('Boot');var bc=bt?bt.getComponent('Boot'):null;if(bc){o.bootReady=bc.ready;o.shown=bc.shown;}var tr=bt&&bt.getChildByName('TitleRoot');o.titleOn=!!(tr&&tr.active);o.canvasOK=!!(cv&&cv.getComponent('cc.Canvas')&&cv.getComponent('cc.Canvas').cameraComponent&&cv.getComponent('cc.Canvas').cameraComponent._createCamera);return JSON.stringify(o);})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_s_boot.png
jsclick:360,900
sleep:5000
eval:(function(){var s=cc.director.getScene();if(!s)return 'NO_SCENE';var o={scene:s.name};var f=window.__tb&&window.__tb.field&&window.__tb.field.I;o.hasField=!!f;if(f){o.bottles=f.bottles?f.bottles.length:-1;var b=f.bottles&&f.bottles[0];if(b){o.tier=b.tier;o.hasArt=!!(b.art&&b.art.isValid);o.artKids=b.node?b.node.children.length:-1;o.scale=Math.round(b.node.scale.x*1000)/1000;o.angle=b.node.angle;}}o.caps=window.__tb?window.__tb.G.data.caps:-1;return JSON.stringify(o);})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_s_main.png
jsclick:360,520
sleep:1200
jsclick:360,560
sleep:1800
eval:(function(){var f=window.__tb&&window.__tb.field&&window.__tb.field.I;if(!f)return 'NO_FIELD';var o={bottles:f.bottles.length,caps:window.__tb.G.data.caps,money:Math.round(window.__tb.G.data.money),flips:window.__tb.G.data.stats?window.__tb.G.data.stats.flips:-1};var anyBusy=false;for(var i=0;i<f.bottles.length;i++){if(f.bottles[i].busy)anyBusy=true;}o.anyBusy=anyBusy;return JSON.stringify(o);})()
shot:E:/LDC_Cocos_PJ/Cocos3X_2D/点瓶子_竖屏/项目/TapBottle/.workbuddy/_s_play.png
