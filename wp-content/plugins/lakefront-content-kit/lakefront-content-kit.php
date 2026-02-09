<?php
/**
 * Plugin Name: Lakefront Content Kit
 * Description: Reusable Lakefront marketing patterns plus a dynamic pricing table block.
 * Version: 0.1.0
 * Requires at least: 6.6
 * Requires PHP: 7.4
 * Author: Lakefront Digital
 * Text Domain: lakefront-content-kit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register reusable patterns and custom dynamic blocks.
 */
function lakefront_content_kit_register_assets() {
	if ( function_exists( 'register_block_pattern_category' ) ) {
		register_block_pattern_category(
			'lakefront',
			array(
				'label' => __( 'Lakefront', 'lakefront-content-kit' ),
			)
		);
	}

	$patterns = array(
		'services-grid'    => array(
			'title'       => __( 'Services Grid', 'lakefront-content-kit' ),
			'description' => __( 'Three-card services section with links and feature bullets.', 'lakefront-content-kit' ),
		),
		'segment-cta-grid' => array(
			'title'       => __( 'Segmented CTA Grid', 'lakefront-content-kit' ),
			'description' => __( 'Audience-specific CTA cards for agencies, creators, and commerce teams.', 'lakefront-content-kit' ),
		),
		'testimonials-grid' => array(
			'title'       => __( 'Testimonials Grid', 'lakefront-content-kit' ),
			'description' => __( 'Three-column testimonial section with avatars and attribution.', 'lakefront-content-kit' ),
		),
		'faq-stack'        => array(
			'title'       => __( 'FAQ Stack', 'lakefront-content-kit' ),
			'description' => __( 'Expanded FAQ stack built with details blocks.', 'lakefront-content-kit' ),
		),
	);

	foreach ( $patterns as $slug => $pattern ) {
		$file = __DIR__ . '/patterns/' . $slug . '.html';
		if ( ! file_exists( $file ) || ! function_exists( 'register_block_pattern' ) ) {
			continue;
		}

		register_block_pattern(
			'lakefront/' . $slug,
			array(
				'title'       => $pattern['title'],
				'description' => $pattern['description'],
				'categories'  => array( 'lakefront' ),
				'inserter'    => true,
				'content'     => file_get_contents( $file ), // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			)
		);
	}

	register_block_type( __DIR__ . '/blocks/pricing-table' );
	register_block_type( __DIR__ . '/blocks/case-study-compare' );
}
add_action( 'init', 'lakefront_content_kit_register_assets' );
