eval (function(){var s=document.createElement('style');s.textContent='*{transition:none!important;animation:none!important}';document.head.appendChild(s);})()
sleep 14
eval (function(){var b=document.querySelector('#tb-boot');if(b){b.remove()}return 'boot:'+(b?'removed':'gone')+' tb:'+!!window.__tb})()
sleep 4
eval (function(){
  var out=[];var scene=cc.director.getScene();
  function walk(n){
    if(n.name==='chipCoin'||n.name==='chipCap'){
      var sp=n.getComponent('cc.Sprite');
      var g=n.getChildByName('gloss'),st=n.getChildByName('stroke');
      out.push({n:n.name,sf:sp&&sp.spriteFrame?sp.spriteFrame.name:'null',type:sp?sp.type:-1,
        gloss:g?!!g.getComponent('cc.Sprite'):'no-node',stroke:st?!!st.getComponent('cc.Sprite'):'no-node',
        sfG:g&&g.getComponent('cc.Sprite')&&g.getComponent('cc.Sprite').spriteFrame?g.getComponent('cc.Sprite').spriteFrame.name:'-'});
    }
    n.children.forEach(walk);
  }
  walk(scene);
  return JSON.stringify(out);
})()
sleep 2
shot nine_game
