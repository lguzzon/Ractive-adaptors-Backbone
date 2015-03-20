let Backbone;
let lockProperty = '_ractiveAdaptorsBackboneLock';

function acquireLock( key ) {
	key[lockProperty] = ( key[lockProperty] || 0 ) + 1;
	return function release() {
		key[lockProperty] -= 1;
		if ( !key[lockProperty] ) {
			delete key[lockProperty];
		}
	};
}

function isLocked( key ) {
	return !!key[lockProperty];
}

let adaptor = {
	init ( ref ) {
		Backbone = ref;
	},
	filter ( object ) {
		if ( !Backbone ) {
			throw new Error( 'Could not find Backbone. You must call adaptor.init(Backbone) - see http://TKTKTK.com for more information' );
		}
		return object instanceof Backbone.Model || object instanceof Backbone.Collection;
	},
	wrap ( ractive, object, keypath, prefix ) {
		if ( object instanceof Backbone.Model ) {
			return new BackboneModelWrapper( ractive, object, keypath, prefix );
		}

		return new BackboneCollectionWrapper( ractive, object, keypath, prefix );
	}
};

// self-init, if being used as a <script> tag
if ( typeof window !== 'undefined' && window.Backbone ) {
	Backbone = window.Backbone;
}

function BackboneModelWrapper ( ractive, model, keypath, prefix ) {
	this.value = model;

	model.on( 'change', this.modelChangeHandler = function () {
		var release = acquireLock( model );
		ractive.set( prefix( model.changed ) );
		release();
	});
}

BackboneModelWrapper.prototype = {
	teardown () {
		this.value.off( 'change', this.modelChangeHandler );
	},
	get () {
		return this.value.toJSON();
	},
	set ( keypath, value ) {
		// Only set if the model didn't originate the change itself, and
		// only if it's an immediate child property
		if ( !isLocked( this.value ) && keypath.indexOf( '.' ) === -1 ) {
			this.value.set( keypath, value );
		}
	},
	reset ( object ) {
		// If the new object is a Backbone model, assume this one is
		// being retired. Ditto if it's not a model at all
		if ( object instanceof Backbone.Model || !(object instanceof Object) ) {
			return false;
		}

		// Otherwise if this is a POJO, reset the model
		//Backbone 1.1.2 no longer has reset and just uses set
		this.value.set( object );
	}
};

function BackboneCollectionWrapper ( ractive, collection, keypath ) {
	this.value = collection;

	collection.on( 'add remove reset sort', this.changeHandler = function () {
		// TODO smart merge. It should be possible, if awkward, to trigger smart
		// updates instead of a blunderbuss .set() approach
		var release = acquireLock( collection );
		ractive.set( keypath, collection.models );
		release();
	});
}

BackboneCollectionWrapper.prototype = {
	teardown () {
		this.value.off( 'add remove reset sort', this.changeHandler );
	},
	get () {
		return this.value.models;
	},
	reset ( models ) {
		if ( isLocked( this.value ) ) {
			return;
		}

		// If the new object is a Backbone collection, assume this one is
		// being retired. Ditto if it's not a collection at all
		if ( models instanceof Backbone.Collection || Object.prototype.toString.call( models ) !== '[object Array]' ) {
			return false;
		}

		// Otherwise if this is a plain array, reset the collection
		this.value.reset( models );
	}
};

export default adaptor;