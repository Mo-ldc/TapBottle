sleep:5200
eval:(function(){var F=cc.Widget.AlignFlags;var o={};for(var k in F){if(typeof F[k]==='number')o[k]=F[k];}var lr=cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot').getChildByName('bootLayer').getChildByName('BootCtl').getChildByName('LoadingRoot');var w=lr.getComponent('cc.Widget');return JSON.stringify({F:o,load:{flags:w.alignFlags,L:w.isAlignLeft,R:w.isAlignRight,T:w.isAlignTop,B:w.isAlignBottom,MID:w.isAlignVerticalCenter,CENTER:w.isAlignHorizontalCenter}});})()
sleep:300
