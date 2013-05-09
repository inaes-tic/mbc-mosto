require('should');

describe("Mosto functional test", function() {
    /*
     * arrancar sin playlists
     ** ver negro

     * arrancar con playlists
     ** ver que haya el play correspondiente
     ** ver que este en el frame correcto

     * arrancar un playlist empezado hace 5m
     ** ver que el frame se mantenga sincronizado durante 10 segundos
     ** mover la playlist hacia atras 1m
     *** ver que el frame se sincronice correctamente
     ** mover la playlist hacia adelante 2m
     *** ver que el frame se sincronice correctamente
     ** borrar la playlist
     *** ver que no se rompa nada
     *** ver que se este pasando negro

     * pruebas de timespan
     ** levantar mosto con una ventana de 1m de ancho
     ** que haya una playlist de 2m empezando now
     ** que haya otra playlist de 30s empezando t+2m
     ** que haya otra playlist de 30s empezando en t+2m30s
     ** al start chequear que solo este la 1er playlist
     ** al 1m05 chequear que la 2da playlist este cargada

     * idem anterior con una playlist de un solo clip
     ** si tengo un clip (playlist?) mas largo que la ventana, deberia haber n+1 cargados
     */
});
