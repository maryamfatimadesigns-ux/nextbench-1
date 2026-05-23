import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export default function SEO({ 
  title = 'Nextbench', 
  description = 'The premiere verified student-to-student marketplace. Buy, sell, and trade within your trusted campus community.',
  image = 'https://nextbench.in/logo.png', // Replace with your actual hosted logo/image URL when deploying
  url = 'https://nextbench.in'
}: SEOProps) {
  // Ensure the title format is correct
  const pageTitle = title === 'Nextbench' ? title : `${title} | Nextbench`;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{pageTitle}</title>
      <meta name="description" content={description} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
    </Helmet>
  );
}
