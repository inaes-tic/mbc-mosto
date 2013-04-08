/*******************
 * This is the pubsub driver that should tell caspa about the melted status
 *
 *******************/

exports = module.exports = function(){
    var defaults = { // copied from caspa/models.App.Status
        _id: 0,
        piece: {
            previous: null,
            curent: null,
            next: null
        },
        show: {
            previous: null,
            current: null,
            next: null,
        },
        source: null,
        no_air: false
    };
};
