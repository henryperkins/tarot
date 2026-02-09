<?php
/**
 * Server-side rendering for the Lakefront pricing table block.
 *
 * @package lakefront-content-kit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$defaults = array(
	'heading'  => 'Choose Your Managed Hosting Plan',
	'intro'    => 'All plans include Google Cloud infrastructure, Cloudflare CDN, and 24/7 monitoring. Scale as you grow.',
	'footnote' => '💡 <strong>Agency partners:</strong> Volume discounts available for 3+ sites. <a href="/partners">Learn about the partner program →</a>',
	'plans'    => array(
		array(
			'name'        => 'Starter',
			'price'       => '$149',
			'period'      => '/mo',
			'tagline'     => 'Perfect for single-site businesses',
			'featured'    => false,
			'buttonLabel' => 'Get Started',
			'buttonUrl'   => '/contact?plan=starter',
			'buttonStyle' => 'outline',
			'features'    => array(
				array(
					'text'     => 'Google Cloud SSD hosting',
					'included' => true,
				),
				array(
					'text'     => 'Cloudflare CDN',
					'included' => true,
				),
				array(
					'text'     => 'Daily backups (30-day retention)',
					'included' => true,
				),
				array(
					'text'     => 'SSL certificate included',
					'included' => true,
				),
				array(
					'text'     => 'Malware scanning',
					'included' => true,
				),
				array(
					'text'     => 'Email support',
					'included' => true,
				),
				array(
					'text'     => 'Staging environment',
					'included' => false,
				),
				array(
					'text'     => 'Dedicated Slack channel',
					'included' => false,
				),
			),
		),
		array(
			'name'        => 'Growth',
			'price'       => '$349',
			'period'      => '/mo',
			'tagline'     => 'For growing WooCommerce stores',
			'featured'    => true,
			'badge'       => 'Most Popular',
			'buttonLabel' => 'Start Growing →',
			'buttonUrl'   => '/contact?plan=growth',
			'buttonStyle' => 'solid',
			'features'    => array(
				array(
					'text'     => 'Everything in Starter, plus:',
					'included' => true,
				),
				array(
					'text'     => '<strong>24/7 uptime monitoring</strong>',
					'included' => true,
				),
				array(
					'text'     => '<strong>Staging environment</strong>',
					'included' => true,
				),
				array(
					'text'     => '<strong>Priority support</strong> (4hr response)',
					'included' => true,
				),
				array(
					'text'     => 'WooCommerce optimization',
					'included' => true,
				),
				array(
					'text'     => 'Monthly performance reports',
					'included' => true,
				),
				array(
					'text'     => '2 hours dev support/month',
					'included' => true,
				),
				array(
					'text'     => 'White-label reports',
					'included' => false,
				),
			),
		),
		array(
			'name'        => 'Enterprise',
			'price'       => '$799',
			'period'      => '/mo',
			'tagline'     => 'For agencies & high-traffic sites',
			'featured'    => false,
			'buttonLabel' => 'Contact Sales',
			'buttonUrl'   => '/contact?plan=enterprise',
			'buttonStyle' => 'outline',
			'features'    => array(
				array(
					'text'     => 'Everything in Growth, plus:',
					'included' => true,
				),
				array(
					'text'     => '<strong>Dedicated Slack channel</strong>',
					'included' => true,
				),
				array(
					'text'     => '<strong>White-label reports</strong>',
					'included' => true,
				),
				array(
					'text'     => '<strong>Multi-site management</strong>',
					'included' => true,
				),
				array(
					'text'     => 'PCI/HIPAA compliance support',
					'included' => true,
				),
				array(
					'text'     => 'Custom SLA (99.95% uptime)',
					'included' => true,
				),
				array(
					'text'     => '8 hours dev support/month',
					'included' => true,
				),
				array(
					'text'     => 'Quarterly strategy reviews',
					'included' => true,
				),
			),
		),
	),
);

$attributes = wp_parse_args( (array) $attributes, $defaults );
$plans      = is_array( $attributes['plans'] ) ? $attributes['plans'] : $defaults['plans'];

$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class' => 'wp-block-group alignfull has-light-grey-background-color has-background',
		'style' => 'padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)',
	)
);

$allowed_feature_html = array(
	'strong' => array(),
	'em'     => array(),
	'span'   => array(
		'class' => true,
	),
	'code'   => array(),
	'a'      => array(
		'href'   => true,
		'target' => true,
		'rel'    => true,
	),
);
?>
<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<h2 class="wp-block-heading has-text-align-center"><?php echo esc_html( (string) $attributes['heading'] ); ?></h2>
	<p class="has-text-align-center" style="margin-bottom:var(--wp--preset--spacing--40)"><?php echo wp_kses_post( (string) $attributes['intro'] ); ?></p>

	<div class="wp-block-columns alignwide" style="gap:var(--wp--preset--spacing--30)">
		<?php foreach ( $plans as $plan ) : ?>
			<?php
			$plan            = is_array( $plan ) ? $plan : array();
			$name            = isset( $plan['name'] ) ? (string) $plan['name'] : '';
			$price           = isset( $plan['price'] ) ? (string) $plan['price'] : '';
			$period          = isset( $plan['period'] ) ? (string) $plan['period'] : '';
			$tagline         = isset( $plan['tagline'] ) ? (string) $plan['tagline'] : '';
			$button_label    = isset( $plan['buttonLabel'] ) ? (string) $plan['buttonLabel'] : '';
			$button_url      = isset( $plan['buttonUrl'] ) ? esc_url( (string) $plan['buttonUrl'] ) : '#';
			$button_style    = isset( $plan['buttonStyle'] ) ? (string) $plan['buttonStyle'] : 'outline';
			$badge           = isset( $plan['badge'] ) ? (string) $plan['badge'] : '';
			$is_featured     = ! empty( $plan['featured'] );
			$features        = isset( $plan['features'] ) && is_array( $plan['features'] ) ? $plan['features'] : array();
			$column_classes  = 'wp-block-column has-white-background-color has-background';
			$column_style    = 'border-radius:12px;padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--30);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--30)';
			$button_classes  = 'wp-block-button has-custom-width wp-block-button__width-100';
			$link_classes    = 'wp-block-button__link wp-element-button';
			$link_style_bits = array( 'border-radius:999px' );

			if ( $is_featured ) {
				$column_classes .= ' has-border-color has-primary-border-color';
				$column_style    = 'border-width:3px;' . $column_style;
			}

			if ( 'solid' === $button_style ) {
				$link_classes .= ' has-primary-background-color has-background';
			} else {
				$button_classes .= ' is-style-outline';
			}
			?>
			<div class="<?php echo esc_attr( $column_classes ); ?>" style="<?php echo esc_attr( $column_style ); ?>">
				<?php if ( $is_featured && '' !== $badge ) : ?>
					<p class="has-text-align-center has-white-color has-primary-background-color has-text-color has-background has-link-color has-tiny-font-size" style="margin-bottom:var(--wp--preset--spacing--15);letter-spacing:1px;text-transform:uppercase"><?php echo esc_html( $badge ); ?></p>
				<?php endif; ?>

				<h3 class="wp-block-heading has-text-align-center has-large-font-size"><?php echo esc_html( $name ); ?></h3>
				<p class="has-text-align-center has-primary-color has-text-color has-xx-large-font-size" style="font-weight:700"><?php echo esc_html( $price ); ?><span class="has-normal-font-size" style="font-weight:400"><?php echo esc_html( $period ); ?></span></p>
				<p class="has-text-align-center has-small-font-size"><?php echo esc_html( $tagline ); ?></p>
				<hr class="wp-block-separator has-alpha-channel-opacity" style="margin-top:var(--wp--preset--spacing--25);margin-bottom:var(--wp--preset--spacing--25)"/>

				<ul class="wp-block-list plan-features">
					<?php foreach ( $features as $feature ) : ?>
						<?php
						$feature     = is_array( $feature ) ? $feature : array( 'text' => (string) $feature );
						$feature_text = isset( $feature['text'] ) ? (string) $feature['text'] : '';
						$included    = ! isset( $feature['included'] ) || (bool) $feature['included'];
						$icon        = $included ? '✅' : '❌';
						$sr_text     = $included ? ' Included:' : ' Not included:';
						?>
						<li><span aria-hidden="true"><?php echo esc_html( $icon ); ?></span><span class="screen-reader-text"><?php echo esc_html( $sr_text ); ?></span> <?php echo wp_kses( $feature_text, $allowed_feature_html ); ?></li>
					<?php endforeach; ?>
				</ul>

				<div class="wp-block-buttons" style="margin-top:var(--wp--preset--spacing--30)">
					<div class="<?php echo esc_attr( $button_classes ); ?>"><a class="<?php echo esc_attr( $link_classes ); ?>" href="<?php echo esc_url( $button_url ); ?>" style="<?php echo esc_attr( implode( ';', $link_style_bits ) ); ?>"><?php echo esc_html( $button_label ); ?></a></div>
				</div>
			</div>
		<?php endforeach; ?>
	</div>

	<p class="has-text-align-center has-small-font-size" style="margin-top:var(--wp--preset--spacing--40)"><?php echo wp_kses_post( (string) $attributes['footnote'] ); ?></p>
</div>
