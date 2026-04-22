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

	function renderMetricControls( metrics, setAttributes ) {
		var controls = metrics.map( function ( metric, index ) {
			var safeMetric = metric && 'object' === typeof metric ? metric : {};

			return createElement(
				'div',
				{
					key: 'metric-' + index,
					style: {
						borderTop: '1px solid #ddd',
						paddingTop: '12px',
						marginTop: '12px',
					},
				},
				createElement( 'strong', null, __( 'Metric ', textDomain ) + ( index + 1 ) ),
				createElement( TextControl, {
					label: __( 'Label', textDomain ),
					value: safeMetric.label || '',
					onChange: function ( value ) {
						setAttributes( {
							metrics: replaceArrayItem( metrics, index, Object.assign( {}, safeMetric, { label: value } ) ),
						} );
					},
				} ),
				createElement( TextControl, {
					label: __( 'Before', textDomain ),
					value: safeMetric.before || '',
					onChange: function ( value ) {
						setAttributes( {
							metrics: replaceArrayItem( metrics, index, Object.assign( {}, safeMetric, { before: value } ) ),
						} );
					},
				} ),
				createElement( TextControl, {
					label: __( 'After', textDomain ),
					value: safeMetric.after || '',
					onChange: function ( value ) {
						setAttributes( {
							metrics: replaceArrayItem( metrics, index, Object.assign( {}, safeMetric, { after: value } ) ),
						} );
					},
				} ),
				renderItemActions(
					metrics.length,
					index,
					function () {
						setAttributes( { metrics: moveArrayItem( metrics, index, -1 ) } );
					},
					function () {
						setAttributes( { metrics: moveArrayItem( metrics, index, 1 ) } );
					},
					function () {
						setAttributes( { metrics: removeArrayItem( metrics, index ) } );
					}
				)
			);
		} );

		controls.push(
			createElement(
				Button,
				{
					key: 'add-metric',
					isSecondary: true,
					onClick: function () {
						setAttributes( {
							metrics: metrics.concat( [ { label: '', before: '', after: '' } ] ),
						} );
					},
				},
				__( 'Add metric', textDomain )
			)
		);

		return controls;
	}

	function renderDeliverableControls( deliverables, setAttributes ) {
		var controls = deliverables.map( function ( deliverable, index ) {
			return createElement(
				'div',
				{
					key: 'deliverable-' + index,
					style: {
						borderTop: '1px solid #ddd',
						paddingTop: '12px',
						marginTop: '12px',
					},
				},
				createElement( 'strong', null, __( 'Deliverable ', textDomain ) + ( index + 1 ) ),
				createElement( TextareaControl, {
					label: __( 'Text', textDomain ),
					help: __( 'Basic inline HTML such as strong tags is allowed.', textDomain ),
					value: deliverable || '',
					onChange: function ( value ) {
						setAttributes( {
							deliverables: replaceArrayItem( deliverables, index, value ),
						} );
					},
				} ),
				renderItemActions(
					deliverables.length,
					index,
					function () {
						setAttributes( { deliverables: moveArrayItem( deliverables, index, -1 ) } );
					},
					function () {
						setAttributes( { deliverables: moveArrayItem( deliverables, index, 1 ) } );
					},
					function () {
						setAttributes( { deliverables: removeArrayItem( deliverables, index ) } );
					}
				)
			);
		} );

		controls.push(
			createElement(
				Button,
				{
					key: 'add-deliverable',
					isSecondary: true,
					onClick: function () {
						setAttributes( {
							deliverables: deliverables.concat( [ '' ] ),
						} );
					},
				},
				__( 'Add deliverable', textDomain )
			)
		);

		return controls;
	}

	function Edit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var metrics = Array.isArray( attributes.metrics ) ? attributes.metrics : [];
		var deliverables = Array.isArray( attributes.deliverables ) ? attributes.deliverables : [];
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
						help: __( 'Basic inline HTML such as links is allowed.', textDomain ),
						value: attributes.intro || '',
						onChange: function ( value ) {
							setAttributes( { intro: value } );
						},
					} ),
					createElement( TextControl, {
						label: __( 'Location label', textDomain ),
						value: attributes.locationLabel || '',
						onChange: function ( value ) {
							setAttributes( { locationLabel: value } );
						},
					} ),
					createElement( TextControl, {
						label: __( 'Before label', textDomain ),
						value: attributes.beforeLabel || '',
						onChange: function ( value ) {
							setAttributes( { beforeLabel: value } );
						},
					} ),
					createElement( TextControl, {
						label: __( 'After label', textDomain ),
						value: attributes.afterLabel || '',
						onChange: function ( value ) {
							setAttributes( { afterLabel: value } );
						},
					} ),
					createElement( TextControl, {
						label: __( 'Note', textDomain ),
						value: attributes.note || '',
						onChange: function ( value ) {
							setAttributes( { note: value } );
						},
					} )
				),
				createElement(
					PanelBody,
					{ title: __( 'Metrics', textDomain ), initialOpen: false },
					metrics.length ? renderMetricControls( metrics, setAttributes ) : [
						createElement( 'p', { key: 'empty-metrics' }, __( 'Add KPI rows for the comparison columns.', textDomain ) ),
						createElement(
							Button,
							{
								key: 'add-first-metric',
								isSecondary: true,
								onClick: function () {
									setAttributes( { metrics: [ { label: '', before: '', after: '' } ] } );
								},
							},
							__( 'Add metric', textDomain )
						)
					]
				),
				createElement(
					PanelBody,
					{ title: __( 'Deliverables', textDomain ), initialOpen: false },
					createElement( TextareaControl, {
						label: __( 'Deliverables intro', textDomain ),
						help: __( 'Basic inline HTML such as links is allowed.', textDomain ),
						value: attributes.deliverablesIntro || '',
						onChange: function ( value ) {
							setAttributes( { deliverablesIntro: value } );
						},
					} ),
					deliverables.length ? renderDeliverableControls( deliverables, setAttributes ) : [
						createElement( 'p', { key: 'empty-deliverables' }, __( 'Add the deliverables list shown beside the KPI comparison.', textDomain ) ),
						createElement(
							Button,
							{
								key: 'add-first-deliverable',
								isSecondary: true,
								onClick: function () {
									setAttributes( { deliverables: [ '' ] } );
								},
							},
							__( 'Add deliverable', textDomain )
						)
					]
				),
				createElement(
					PanelBody,
					{ title: __( 'CTA', textDomain ), initialOpen: false },
					createElement( TextControl, {
						label: __( 'CTA label', textDomain ),
						value: attributes.ctaLabel || '',
						onChange: function ( value ) {
							setAttributes( { ctaLabel: value } );
						},
					} ),
					createElement( TextControl, {
						label: __( 'CTA URL', textDomain ),
						type: 'url',
						value: attributes.ctaUrl || '',
						onChange: function ( value ) {
							setAttributes( { ctaUrl: value } );
						},
					} )
				)
			),
			createElement(
				'div',
				blockProps,
				ServerSideRender ? createElement(
					Disabled,
					null,
					createElement( ServerSideRender, {
						block: 'lakefront/case-study-compare',
						attributes: attributes,
						httpMethod: 'POST',
					} )
				) : createElement( 'p', null, __( 'Server-side preview unavailable.', textDomain ) )
			)
		);
	}

	registerBlockType( 'lakefront/case-study-compare', {
		edit: Edit,
		save: function () {
			return null;
		},
	} );
} )( window.wp );
