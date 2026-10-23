// Keep the original road projection, chase camera and speed effects as the
// normal presentation. The experimental WebGL scene is an explicit opt-in.
if (new URLSearchParams(location.search).get('renderer') === 'hd') {
  import('./main.js').catch(error => console.warn('Experimental renderer unavailable:', error.message));
}
