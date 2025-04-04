import axios from 'axios';
import { JSDOM } from 'jsdom';
import { URL } from 'url';
import { Dependency } from '../types/index.js';

const BASE_URL = "https://scarbs.xyz/";

/**
 * Fetches all packages from the Scarbs website
 * @returns An async generator of package tuples [name, version]
 */
export async function* fetchAllPackages(): AsyncGenerator<[string, string]> {
  const response = await axios.get(new URL('/packages', BASE_URL).toString());
  const dom = new JSDOM(response.data);
  const document = dom.window.document;
  
  let totalPages = 1;
  const pageLinks = document.querySelectorAll('a[href*="?page="]');
  
  for (const link of pageLinks) {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/.*page=(\d+).*/);
      if (match) {
        const pageNumber = parseInt(match[1], 10);
        totalPages = Math.max(totalPages, pageNumber);
      }
    }
  }
  
  for (let page = 1; page <= totalPages; page++) {
    const pageUrl = new URL(`/packages?page=${page}`, BASE_URL).toString();
    yield* getPackagesFromPage(pageUrl);
  }
}

/**
 * Fetches packages from a specific page of the Scarbs website
 * @param pageUrl The URL of the page to fetch packages from
 * @returns An async generator of package tuples [name, version]
 */
export async function* getPackagesFromPage(pageUrl: string): AsyncGenerator<[string, string]> {
  const response = await axios.get(pageUrl);
  const dom = new JSDOM(response.data);
  const document = dom.window.document;
  
  const packageLinks = document.querySelectorAll('a[href*="/packages/"]');
  
  for (const link of packageLinks) {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/.*\/packages\/([^/]+)(?:$|\/.*)/);
      if (match) {
        const packageName = match[1];
        
        const versionSpan = link.parentElement?.querySelector('span');
        const version = versionSpan?.textContent?.trim() || '';
        
        yield [packageName, version];
      }
    }
  }
}

/**
 * Fetches all packages from the Scarbs website and returns a list of dependencies
 * @returns A list of dependencies
 */
export async function getAllPackagesList(): Promise<Dependency[]> {
  const packagesList: Dependency[] = [];
  
  for await (const packageInfo of fetchAllPackages()) {
    packagesList.push({
      name: packageInfo[0],
      version: packageInfo[1],
    });
  }
  
  return packagesList;
}


