( function ( wp ) {
	if ( ! wp || ! wp.blocks || ! wp.blockEditor || ! wp.components || ! wp.element || ! wp.i18n ) {
		return;
	}

	var registerBlockType = wp.blocks.registerBlockType;
	var blockEditor = wp.blockEditor;
	var components = wp.components;
	var createElement = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;
	var InspectorControls = blockEditor.InspectorControls;
	var useBlockProps = blockEditor.useBlockProps;
	var PanelBody = components.PanelBody;
	var TextControl = components.TextControl;
	var TextareaControl = components.TextareaControl;
	var ToggleControl = components.ToggleControl;
	var SelectControl = components.SelectControl;
	var Button = components.Button;
	var Disabled = components.Disabled;
	var serverSideRenderModule = wp.serverSideRender;
	var ServerSideRender = serverSideRenderModule && ( serverSideRenderModule.ServerSideRender || serverSideRenderModule.default || serverSideRenderModule );
	var textDomain = 'lakefront-content-kit';

	function cloneArray( values ) {
		return Array.isArray( values ) ? values.slice() : [];
	}

	function replaceArrayItem( values, index, nextItem ) {
		var nextValues = cloneArray( values );

		nextValues[ index ] = nextItem;

		return nextValues;
	}

	function removeArrayItem( values, index ) {
		return cloneArray( values ).filter( function ( item, itemIndex ) {
			return itemIndex !== index;
		} );
	}

	function moveArrayItem( values, index, offset ) {
		var nextValues = cloneArray( values );
		var targetIndex = index + offset;
		var temporaryItem;

		if ( targetIndex < 0 || targetIndex >= nextValues.length ) {
			return nextValues;
		}

		temporaryItem = nextValues[ targetIndex ];
		nextValues[ targetIndex ] = nextValues[ index ];
		nextValues[ index ] = temporaryItem;

		return nextValues;
	}

	function renderItemActions( length, index, onMoveUp, onMoveDown, onRemove ) {
		var children = [];

		if ( index > 0 ) {
			children.push(
				createElement(
					Button,
					{
						key: 'up',
						isSecondary: true,
						isSmall: true,
						onClick: onMoveUp,
					},
					__( 'Move up', textDomain )
				)
			);
		}

		if ( index < length - 1 ) {
			children.push(
				createElement(
					Button,
					{
						key: 'down',
						isSecondary: true,
						isSmall: true,
						onClick: onMoveDown,
					},
					__( 'Move down', textDomain )
				)
			);
		}

		children.push(
			createElement(
				Button,
				{
					key: 'remove',
					isDestructive: true,
					isSmall: true,
					onClick: onRemove,
				},
				__( 'Remove', textDomain )
			)
		);

		return createElement(
			'div',
			{
				style: {
					display: 'flex',
					gap: '8px',
					marginTop: '8px',
					marginBottom: '8px',
					flexWrap: 'wrap',
				},
			},
			children
		);
	}

	function updatePlan( plans, index, key, value ) {
		var safePlan = plans[ index ] && 'object' === typeof plans[ index ] ? plans[ index ] : {};

		return replaceArrayItem( plans, index, Object.assign( {}, safePlan, ( function () {
			var nextPlan = {};

			nextPlan[ key ] = value;

			return nextPlan;
		} )() ) );
	}

	function renderFeatureControls( plans, planIndex, setAttributes ) {
		var safePlan = plans[ planIndex ] && 'object' === typeof plans[ planIndex ] ? plans[ planIndex ] : {};
		var features = Array.isArray( safePlan.features ) ? safePlan.features : [];
		var controls = features.map( function ( feature, featureIndex ) {
			var safeFeature = feature && 'object' === typeof feature ? feature : {};
			var nextFeatures;

			return createElement(
				'div',
				{
					key: 'feature-' + featureIndex,
					style: {
						borderTop: '1px solid #ddd',
						paddingTop: '12px',
						marginTop: '12px',
					},
				},
				createElement( 'strong', null, __( 'Feature ', textDomain ) + ( featureIndex + 1 ) ),
				createElement( TextareaControl, {
					label: __( 'Feature text', textDomain ),
					help: __( 'Basic inline HTML such as strong tags is allowed.', textDomain ),
					value: safeFeature.text || '',
					onChange: function ( value ) {
						nextFeatures = replaceArrayItem( features, featureIndex, Object.assign( {}, safeFeature, { text: value } ) );
						setAttributes( { plans: updatePlan( plans, planIndex, 'features', nextFeatures ) } );
					},
				} ),
				createElement( ToggleControl, {
					label: __( 'Included', textDomain ),
					checked: ! ( false === safeFeature.included ),
					onChange: function ( value ) {
						nextFeatures = replaceArrayItem( features, featureIndex, Object.assign( {}, safeFeature, { included: value } ) );
						setAttributes( { plans: updatePlan( plans, planIndex, 'features', nextFeatures ) } );
					},
				} ),
				renderItemActions(
					features.length,
					featureIndex,
					function () {
						setAttributes( { plans: updatePlan( plans, planIndex, 'features', moveArrayItem( features, featureIndex, -1 ) ) } );
					},
					function () {
						setAttributes( { plans: updatePlan( plans, planIndex, 'features', moveArrayItem( features, featureIndex, 1 ) ) } );
					},
					function () {
						setAttributes( { plans: updatePlan( plans, planIndex, 'features', removeArrayItem( features, featureIndex ) ) } );
					}
				)
			);
		} );

		controls.push(
			createElement(
				Button,
				{
					key: 'add-feature',
					isSecondary: true,
					onClick: function () {
						setAttributes( {
							plans: updatePlan( plans, planIndex, 'features', features.concat( [ { text: '', included: true } ] ) ),
						} );
					},
				},
				__( 'Add feature', textDomain )
			)
		);

		return controls;
	}

	function renderPlanControls( plans, setAttributes ) {
		var controls = plans.map( function ( plan, planIndex ) {
			var safePlan = plan && 'object' === typeof plan ? plan : {};

			return createElement(
				'div',
				{
					key: 'plan-' + planIndex,
					style: {
						borderTop: '1px solid #ddd',
						paddingTop: '12px',
						marginTop: '12px',
					},
				},
				createElement( 'strong', null, __( 'Plan ', textDomain ) + ( planIndex + 1 ) ),
				createElement( TextControl, {
					label: __( 'Name', textDomain ),
					value: safePlan.name || '',
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'name', value ) } );
					},
				} ),
				createElement( TextControl, {
					label: __( 'Price', textDomain ),
					value: safePlan.price || '',
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'price', value ) } );
					},
				} ),
				createElement( TextControl, {
					label: __( 'Period', textDomain ),
					value: safePlan.period || '',
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'period', value ) } );
					},
				} ),
				createElement( TextControl, {
					label: __( 'Tagline', textDomain ),
					value: safePlan.tagline || '',
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'tagline', value ) } );
					},
				} ),
				createElement( ToggleControl, {
					label: __( 'Featured plan', textDomain ),
					checked: !! safePlan.featured,
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'featured', value ) } );
					},
				} ),
				createElement( TextControl, {
					label: __( 'Badge', textDomain ),
					value: safePlan.badge || '',
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'badge', value ) } );
					},
				} ),
				createElement( TextControl, {
					label: __( 'Button label', textDomain ),
					value: safePlan.buttonLabel || '',
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'buttonLabel', value ) } );
					},
				} ),
				createElement( TextControl, {
					label: __( 'Button URL', textDomain ),
					type: 'url',
					value: safePlan.buttonUrl || '',
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'buttonUrl', value ) } );
					},
				} ),
				createElement( SelectControl, {
					label: __( 'Button style', textDomain ),
					value: safePlan.buttonStyle || 'outline',
					options: [
						{ label: __( 'Outline', textDomain ), value: 'outline' },
						{ label: __( 'Solid', textDomain ), value: 'solid' },
					],
					onChange: function ( value ) {
						setAttributes( { plans: updatePlan( plans, planIndex, 'buttonStyle', value ) } );
					},
				} ),
				createElement( 'strong', { style: { display: 'block', marginTop: '12px' } }, __( 'Features', textDomain ) ),
				(Array.isArray( safePlan.features ) && safePlan.features.length) ? renderFeatureControls( plans, planIndex, setAttributes ) : [
					createElement( 'p', { key: 'empty-features' }, __( 'Add the feature checklist for this plan.', textDomain ) ),
					createElement(
						Button,
						{
							key: 'add-first-feature',
							isSecondary: true,
							onClick: function () {
								setAttributes( {
									plans: updatePlan( plans, planIndex, 'features', [ { text: '', included: true } ] ),
								} );
							},
						},
						__( 'Add feature', textDomain )
					)
				],
				renderItemActions(
					plans.length,
					planIndex,
					function () {
						setAttributes( { plans: moveArrayItem( plans, planIndex, -1 ) } );
					},
					function () {
						setAttributes( { plans: moveArrayItem( plans, planIndex, 1 ) } );
					},
					function () {
						setAttributes( { plans: removeArrayItem( plans, planIndex ) } );
					}
				)
			);
		} );

		controls.push(
			createElement(
				Button,
				{
					key: 'add-plan',
					isSecondary: true,
					onClick: function () {
						setAttributes( {
							plans: plans.concat( [ {
								name: '',
								price: '',
								period: '',
								tagline: '',
								featured: false,
								badge: '',
								buttonLabel: '',
								buttonUrl: '',
								buttonStyle: 'outline',
								features: [],
							} ] ),
						} );
					},
				},
				__( 'Add plan', textDomain )
			)
		);

		return controls;
	}

	function Edit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var plans = Array.isArray( attributes.plans ) ? attributes.plans : [];
		var blockProps = useBlockProps();

		return createElement(
			Fragment,
			null,
			createElement(
				InspectorControls,
				null,
				createElement(
					PanelBody,
					{ title: __( 'Content', textDomain ), initialOpen: true },
					createElement( TextControl, {
						label: __( 'Heading', textDomain ),
						value: attributes.heading || '',
						onChange: function ( value ) {
							setAttributes( { heading: value } );
						},
					} ),
					createElement( TextareaControl, {
						label: __( 'Intro', textDomain ),
						value: attributes.intro || '',
						onChange: function ( value ) {
							setAttributes( { intro: value } );
						},
					} ),
					createElement( TextareaControl, {
						label: __( 'Footnote', textDomain ),
						help: __( 'Basic inline HTML such as links and strong tags is allowed.', textDomain ),
						value: attributes.footnote || '',
						onChange: function ( value ) {
							setAttributes( { footnote: value } );
						},
					} )
				),
				createElement(
					PanelBody,
					{ title: __( 'Plans', textDomain ), initialOpen: false },
					plans.length ? renderPlanControls( plans, setAttributes ) : [
						createElement( 'p', { key: 'empty-plans' }, __( 'Add one or more plans for the pricing table.', textDomain ) ),
						createElement(
							Button,
							{
								key: 'add-first-plan',
								isSecondary: true,
								onClick: function () {
									setAttributes( {
										plans: [ {
											name: '',
											price: '',
											period: '',
											tagline: '',
											featured: false,
											badge: '',
											buttonLabel: '',
											buttonUrl: '',
											buttonStyle: 'outline',
											features: [],
										} ],
									} );
								},
							},
							__( 'Add plan', textDomain )
						)
					]
				)
			),
			createElement(
				'div',
				blockProps,
				ServerSideRender ? createElement(
					Disabled,
					null,
					createElement( ServerSideRender, {
						block: 'lakefront/pricing-table',
						attributes: attributes,
						httpMethod: 'POST',
					} )
				) : createElement( 'p', null, __( 'Server-side preview unavailable.', textDomain ) )
			)
		);
	}

	registerBlockType( 'lakefront/pricing-table', {
		edit: Edit,
		save: function () {
			return null;
		},
	} );
} )( window.wp );
