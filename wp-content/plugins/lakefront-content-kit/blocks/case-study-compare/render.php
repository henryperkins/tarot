<?php
/**
 * Server-side rendering for the Lakefront case study comparison block.
 *
 * @package lakefront-content-kit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$defaults = array(
	'heading'         => 'Real Results: Chicago Retailer Scaling on WooCommerce',
	'intro'           => 'See what happens when you combine managed Google Cloud hosting, Cloudflare edge caching, and conversion-focused optimization.',
	'locationLabel'   => 'B2C Commerce Brand · Chicago',
	'beforeLabel'     => 'Before',
	'afterLabel'      => 'After',
	'metrics'         => array(
		array(
			'label'  => 'Page Load Time',
			'before' => '4.8s',
			'after'  => '1.3s ⚡',
		),
		array(
			'label'  => 'Bounce Rate',
			'before' => '62%',
			'after'  => '41% 📉',
		),
		array(
			'label'  => 'Monthly Revenue',
			'before' => '$48K',
			'after'  => '$65K 📈',
		),
	),
	'deliverablesIntro' => 'We migrated this growing Chicago retailer from legacy shared hosting to our fully managed <a href="/blog/google-cloud-wordpress-hosting">Google Cloud cluster</a>. The project included:',
	'deliverables'      => array(
		'✅ <strong>Zero-downtime migration</strong> with DNS orchestration',
		'✅ <strong>Cloudflare Workers</strong> edge caching implementation',
		'✅ <strong>Technical SEO</strong> audit &amp; schema markup',
		'✅ <strong>Checkout flow optimization</strong> (+22% completion rate)',
		'✅ <strong>Core Web Vitals</strong> tuning for all green scores',
	),
	'note'            => 'Full case study, architecture diagram, and KPI breakdown available upon request.',
	'ctaLabel'        => 'Read the Full Case Study →',
	'ctaUrl'          => '/case-studies',
);

$attributes  = wp_parse_args( (array) $attributes, $defaults );
$metrics     = isset( $attributes['metrics'] ) && is_array( $attributes['metrics'] ) ? $attributes['metrics'] : $defaults['metrics'];
$deliverables = isset( $attributes['deliverables'] ) && is_array( $attributes['deliverables'] ) ? $attributes['deliverables'] : $defaults['deliverables'];

$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'id'    => 'case-studies',
		'class' => 'wp-block-group alignfull has-light-grey-background-color has-background',
		'style' => 'padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)',
	)
);

$allowed_inline_html = array(
	'strong' => array(),
	'em'     => array(),
	'a'      => array(
		'href'   => true,
		'target' => true,
		'rel'    => true,
	),
	'span'   => array(
		'class' => true,
	),
);
?>
<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<div class="wp-block-group alignwide">
		<h2 class="wp-block-heading has-text-align-center"><?php echo esc_html( (string) $attributes['heading'] ); ?></h2>
		<p class="has-text-align-center" style="margin-bottom:var(--wp--preset--spacing--50)"><?php echo wp_kses_post( (string) $attributes['intro'] ); ?></p>

		<div class="wp-block-columns alignwide are-vertically-aligned-center" style="gap:var(--wp--preset--spacing--50)">
			<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:55%">
				<div class="wp-block-group has-white-background-color has-background" style="border-radius:12px;padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)">
					<h3 class="wp-block-heading has-primary-color has-text-color" style="margin-bottom:var(--wp--preset--spacing--30)"><?php echo esc_html( (string) $attributes['locationLabel'] ); ?></h3>

					<div class="wp-block-columns" style="gap:var(--wp--preset--spacing--30)">
						<div class="wp-block-column">
							<h4 class="wp-block-heading has-tertiary-color has-text-color has-tiny-font-size" style="letter-spacing:1px;text-transform:uppercase"><?php echo esc_html( (string) $attributes['beforeLabel'] ); ?></h4>
							<?php foreach ( $metrics as $index => $metric ) : ?>
								<?php
								$metric = is_array( $metric ) ? $metric : array();
								?>
								<p class="has-dark-color has-text-color has-x-large-font-size" style="font-weight:600"><?php echo esc_html( isset( $metric['before'] ) ? (string) $metric['before'] : '' ); ?></p>
								<p class="has-small-font-size"><?php echo esc_html( isset( $metric['label'] ) ? (string) $metric['label'] : '' ); ?></p>
								<?php if ( $index < count( $metrics ) - 1 ) : ?>
									<hr class="wp-block-separator has-alpha-channel-opacity" style="margin-top:var(--wp--preset--spacing--20);margin-bottom:var(--wp--preset--spacing--20)"/>
								<?php endif; ?>
							<?php endforeach; ?>
						</div>

						<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:40px">
							<p class="has-text-align-center has-x-large-font-size">→</p>
						</div>

						<div class="wp-block-column">
							<h4 class="wp-block-heading has-primary-color has-text-color has-tiny-font-size" style="letter-spacing:1px;text-transform:uppercase"><?php echo esc_html( (string) $attributes['afterLabel'] ); ?></h4>
							<?php foreach ( $metrics as $index => $metric ) : ?>
								<?php
								$metric = is_array( $metric ) ? $metric : array();
								?>
								<p class="has-primary-color has-text-color has-x-large-font-size" style="font-weight:700"><?php echo esc_html( isset( $metric['after'] ) ? (string) $metric['after'] : '' ); ?></p>
								<p class="has-small-font-size"><?php echo esc_html( isset( $metric['label'] ) ? (string) $metric['label'] : '' ); ?></p>
								<?php if ( $index < count( $metrics ) - 1 ) : ?>
									<hr class="wp-block-separator has-alpha-channel-opacity" style="margin-top:var(--wp--preset--spacing--20);margin-bottom:var(--wp--preset--spacing--20)"/>
								<?php endif; ?>
							<?php endforeach; ?>
						</div>
					</div>
				</div>
			</div>

			<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:45%">
				<h3 class="wp-block-heading">What We Delivered</h3>
				<p><?php echo wp_kses( (string) $attributes['deliverablesIntro'], $allowed_inline_html ); ?></p>
				<ul class="wp-block-list">
					<?php foreach ( $deliverables as $deliverable ) : ?>
						<li><?php echo wp_kses( (string) $deliverable, $allowed_inline_html ); ?></li>
					<?php endforeach; ?>
				</ul>
				<p style="font-style:italic"><?php echo esc_html( (string) $attributes['note'] ); ?></p>
				<div class="wp-block-buttons" style="margin-top:var(--wp--preset--spacing--30)">
					<div class="wp-block-button"><a class="wp-block-button__link has-primary-background-color has-background wp-element-button" href="<?php echo esc_url( (string) $attributes['ctaUrl'] ); ?>" style="border-radius:999px"><?php echo esc_html( (string) $attributes['ctaLabel'] ); ?></a></div>
				</div>
			</div>
		</div>
	</div>
</div>
