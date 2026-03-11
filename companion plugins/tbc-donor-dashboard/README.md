# Two Birds Church - Donor Dashboard

A WordPress plugin that creates an enhanced donor dashboard with yearly PDF reports for Two Birds Church. This plugin integrates with WooCommerce to provide donors with detailed information about their contributions and the ability to download yearly donation summaries.

## Features

- **Personalized donor dashboard** displaying lifetime donations and statistics
- **Yearly donation report generation** in PDF format with professional church branding
- **Secure access control** with nonce verification and user authentication
- **Mobile-responsive design** with accessibility features
- **Performance optimized** with caching and efficient database queries
- **Tax-friendly reporting** format with proper 501(c)(3) documentation
- **Admin cleanup tool** for managing generated PDF files

## Requirements

- WordPress 5.0 or higher
- WooCommerce 4.0 or higher
- PHP 7.4 or higher
- TCPDF library (included)

## Installation

1. Download the plugin zip file
2. Go to WordPress admin panel → Plugins → Add New
3. Click "Upload Plugin" and select the downloaded zip file
4. Click "Install Now" and then "Activate"

## Configuration

### Basic Setup

1. Navigate to WordPress admin panel → Settings → Donor Dashboard
2. Upload your church logo (recommended size: 300x100px)
3. Enter your church's tax information (EIN number)
4. Update contact information for the PDF reports
5. Save changes

### Shortcode Usage

Add the donor dashboard to any page using the shortcode:

```
[donor_dashboard]
```

## Code Organization

### Class Structure

- **TBC_Donor_Dashboard**: Main controller handling shortcode rendering and AJAX requests
- **TBC_Donation_Data**: Data layer for donation queries and statistics  
- **TBC_PDF_Generator**: PDF generation with TCPDF integration and professional formatting

### Modern Practices

- Clean method organization and readable code structure
- Proper input sanitization and validation
- WordPress coding standards compliance
- Streamlined functionality with no unused methods

## Usage

### For Donors

1. Log in to their WordPress account
2. Navigate to the page containing the donor dashboard
3. View their donation history and statistics
4. Select a year from the dropdown menu
5. Click "Download Report" to generate and download their yearly donation report

## Administration

### For Administrators

1. Access donor information through WooCommerce orders
2. Monitor PDF generation through WordPress error logs
3. **PDF Cleanup**: Go to Tools → Cleanup Donor PDFs to remove old PDF files
4. Configure church information and branding through code constants



## Troubleshooting

### Common Issues

1. **PDF Generation Fails**
   - Check PHP memory limit (recommended: 256MB+)
   - Verify file permissions in wp-content/uploads
   - Check error logs for specific TCPDF errors

2. **Donation Data Not Showing**
   - Verify WooCommerce is active and properly configured
   - Check that orders have 'completed' status
   - Use Tools → Cleanup Donor PDFs if having file-related issues

3. **Performance Issues**
   - Check for plugin conflicts
   - Monitor database query performance
   - Ensure adequate PHP memory limit

### Debug Mode

Enable debug mode by adding to wp-config.php:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

## Security Considerations

- **Data Protection**: Donor information is only accessible to authenticated users
- **File Management**: Admin tool available for manual PDF cleanup (Tools → Cleanup Donor PDFs)
- **Input Validation**: All user inputs are sanitized and validated
- **Access Control**: Proper WordPress capability checks throughout



## Contributing

We welcome contributions to improve the plugin:

1. Fork the repository
2. Create a feature branch
3. Follow WordPress coding standards
4. Submit a pull request



## License

This plugin is licensed under the GPL v2 or later.

## Support

For support inquiries:
- Email: support@twobirdschurch.org
- Documentation: [Link to documentation]
- GitHub Issues: [Link to repository]

## Changelog

### 1.0.0
- Refactored codebase for better organization and maintainability
- Removed unused methods and legacy code
- Added admin tool for PDF cleanup (Tools → Cleanup Donor PDFs)
- Streamlined classes to only include actively used functionality
- Improved code structure without adding complexity

## Roadmap

### Near Term (v1.1.0)
- Email delivery of reports
- Enhanced reporting with donation trends
- Additional export formats (CSV, Excel)

### Medium Term (v1.2.0)
- **Additional export formats** (CSV, Excel)
- **Donation goal tracking** and progress visualization
- **Recurring donation insights** and analytics

### Long Term (v2.0.0)
- **Campaign-specific reporting** and tracking
- **Integration with email marketing platforms**
- **Advanced donor analytics** and engagement metrics
- **REST API** for external integrations