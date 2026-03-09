#!/usr/bin/env node
/**
 * Test script to verify redirect errors are fixed
 * Tests URLs both with and without trailing slashes to ensure consistency
 */

const testUrls = [
  'https://anivaryam.github.io/blogs/how-to-convert-word-html-clean-seo-friendly',
  'https://anivaryam.github.io/tools/word-to-html',
  'https://anivaryam.github.io/tools/web-scraper',
  'https://anivaryam.github.io/tools/qr-code-generator',
  'https://anivaryam.github.io/school-projects',
  'https://anivaryam.github.io/news',
  'https://anivaryam.github.io/about',
  'https://anivaryam.github.io/blogs',
  'https://anivaryam.github.io/blogs/random-universe-cipher-ruc-post-quantum-security',
];

async function testUrl(url) {
  try {
    // Test URL without trailing slash
    const responseNoSlash = await fetch(url, { 
      method: 'HEAD',
      redirect: 'manual' // Don't follow redirects automatically
    });
    
    // Test URL with trailing slash
    const urlWithSlash = url.endsWith('/') ? url : url + '/';
    const responseWithSlash = await fetch(urlWithSlash, { 
      method: 'HEAD',
      redirect: 'manual'
    });
    
    const statusNoSlash = responseNoSlash.status;
    const statusWithSlash = responseWithSlash.status;
    const locationNoSlash = responseNoSlash.headers.get('location');
    
    return {
      url,
      urlWithSlash,
      statusNoSlash,
      statusWithSlash,
      locationNoSlash,
      hasRedirect: statusNoSlash === 301 || statusNoSlash === 302,
      redirectsToCorrectUrl: locationNoSlash === urlWithSlash,
      bothWork: statusWithSlash === 200
    };
  } catch (error) {
    return {
      url,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🔍 Testing URLs for redirect issues...\n');
  
  const results = await Promise.all(testUrls.map(testUrl));
  
  let allPassed = true;
  let redirectCount = 0;
  
  results.forEach((result, index) => {
    if (result.error) {
      console.log(`❌ ${result.url}`);
      console.log(`   Error: ${result.error}\n`);
      allPassed = false;
      return;
    }
    
    const status = result.hasRedirect ? '⚠️' : '✅';
    console.log(`${status} ${result.url}`);
    
    if (result.hasRedirect) {
      redirectCount++;
      console.log(`   Status (no slash): ${result.statusNoSlash}`);
      console.log(`   Redirects to: ${result.locationNoSlash}`);
      
      if (result.redirectsToCorrectUrl) {
        console.log(`   ✅ Redirects to correct URL (with trailing slash)`);
      } else {
        console.log(`   ❌ Redirects to incorrect URL!`);
        allPassed = false;
      }
    } else {
      console.log(`   Status (no slash): ${result.statusNoSlash}`);
    }
    
    console.log(`   Status (with slash): ${result.statusWithSlash}`);
    
    if (result.bothWork) {
      console.log(`   ✅ URL with trailing slash works correctly`);
    } else {
      console.log(`   ❌ URL with trailing slash returns ${result.statusWithSlash}`);
      allPassed = false;
    }
    
    console.log('');
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Summary:`);
  console.log(`   Total URLs tested: ${results.length}`);
  console.log(`   URLs with redirects: ${redirectCount}`);
  console.log(`   URLs without redirects: ${results.length - redirectCount}`);
  console.log('');
  
  if (allPassed && redirectCount > 0) {
    console.log('✅ All redirects are working correctly!');
    console.log('   Note: Redirects are expected and correct.');
    console.log('   GitHub Pages redirects URLs without trailing slashes');
    console.log('   to URLs with trailing slashes (301 redirect).');
    console.log('   As long as the sitemap uses trailing slashes,');
    console.log('   Google Search Console should not report errors.');
  } else if (allPassed) {
    console.log('✅ All URLs work correctly without redirects!');
  } else {
    console.log('❌ Some URLs have issues that need to be fixed.');
  }
  console.log('');
  
  // Test sitemap URLs
  console.log('🔍 Checking sitemap consistency...\n');
  try {
    const sitemapResponse = await fetch('https://anivaryam.github.io/sitemap.xml');
    const sitemapText = await sitemapResponse.text();
    
    // Check if sitemap URLs have trailing slashes
    const urlsInSitemap = sitemapText.match(/<loc>(https:\/\/anivaryam\.github\.io\/[^<]+)<\/loc>/g) || [];
    const urlsWithoutSlash = urlsInSitemap.filter(url => {
      const match = url.match(/<loc>(https:\/\/anivaryam\.github\.io\/[^<]+)<\/loc>/);
      if (!match) return false;
      const urlPath = match[1];
      // Exclude homepage and files (with extensions)
      return urlPath !== 'https://anivaryam.github.io/' && 
             !urlPath.match(/\.(xml|txt|html|json|ico|png|jpg|jpeg|svg|webmanifest|js|css|woff|woff2|ttf|eot|wasm)$/i) &&
             !urlPath.endsWith('/');
    });
    
    if (urlsWithoutSlash.length === 0) {
      console.log('✅ Sitemap URLs all have trailing slashes (correct)');
      console.log(`   Total URLs in sitemap: ${urlsInSitemap.length}`);
    } else {
      console.log(`⚠️  Found ${urlsWithoutSlash.length} URLs in sitemap without trailing slashes:`);
      urlsWithoutSlash.slice(0, 10).forEach(url => {
        const match = url.match(/<loc>(https:\/\/anivaryam\.github\.io\/[^<]+)<\/loc>/);
        console.log(`   - ${match ? match[1] : url}`);
      });
      if (urlsWithoutSlash.length > 10) {
        console.log(`   ... and ${urlsWithoutSlash.length - 10} more`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not check sitemap: ${error.message}`);
  }
  
  console.log('');
}

// Run tests
runTests().catch(console.error);

