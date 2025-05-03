/**
 * Represents a parsed shields.io badge
 */
export interface Badge {
  /** The original markdown string */
  markdown: string;
  /** The badge URL */
  url: string;
  /** Start index in the original markdown */
  startIndex: number;
  /** End index in the original markdown */
  endIndex: number;
  /** The label text (left side of badge) */
  label: string;
  /** The message text (right side of badge) */
  message: string;
  /** The badge color */
  color?: string;
  /** The URL this badge links to */
  linkUrl: string;
  /** Optional logo identifier */
  logo?: string;
  /** Optional logo color */
  logoColor?: string;
  /** Optional label color */
  labelColor?: string;
  /** Optional badge style */
  style?: string;
}

/**
 * Options for updating a badge
 */
export interface BadgeUpdateOptions {
  /** New label text */
  label?: string;
  /** New message/version text */
  message?: string;
  /** New color */
  color?: string;
  /** New logo identifier */
  logo?: string;
  /** New logo color */
  logoColor?: string;
  /** New label color */
  labelColor?: string;
  /** New badge style */
  style?: string;
  /** New link URL */
  linkUrl?: string;
}

/**
 * A TypeScript class for managing shields.io badges in markdown.
 * Allows parsing, updating, and generating markdown for shields.io badges.
 */
export class ShieldsBadgeManager {
  /**
   * Parses markdown text and extracts all shields.io badges
   * @param markdown The markdown text containing badges
   * @returns Array of parsed Badge objects
   */
  public parseBadgesFromMarkdown(markdown: string): Badge[] {
    const badgeRegex = /\[\!\[(.*?)\]\((.*?)\)\]\((.*?)\)/g;
    const badges: Badge[] = [];
    let match: RegExpExecArray | null;

    while ((match = badgeRegex.exec(markdown)) !== null) {
      const [fullMarkdown, altText, badgeUrl, linkUrl] = match;
      const startIndex = match.index;
      const endIndex = startIndex + fullMarkdown.length;

      // Only process shields.io badges
      if (badgeUrl && badgeUrl.includes("img.shields.io/badge")) {
        const parsedBadge = this.parseShieldsIoBadge(badgeUrl);
        if (parsedBadge) {
          badges.push({
            markdown: fullMarkdown,
            url: badgeUrl,
            startIndex: startIndex,
            endIndex: endIndex,
            label: parsedBadge.label,
            message: parsedBadge.message,
            color: parsedBadge.color,
            linkUrl: linkUrl || "",
            logo: parsedBadge.logo,
            logoColor: parsedBadge.logoColor,
            labelColor: parsedBadge.labelColor,
            style: parsedBadge.style,
          });
        }
      }
    }

    return badges;
  }

  /**
   * Parses a shields.io badge URL
   * @param url The shields.io badge URL
   * @returns Parsed badge components or null if not a valid shields.io badge
   */
  private parseShieldsIoBadge(
    url: string
  ): Omit<
    Badge,
    "markdown" | "url" | "linkUrl" | "startIndex" | "endIndex"
  > | null {
    // Extract the badge part from the URL
    const badgeUrlMatch = url.match(
      /https:\/\/img\.shields\.io\/badge\/([^)]+)/
    );
    if (!badgeUrlMatch) return null;

    const badgeUrl = badgeUrlMatch[1];

    // Split by query parameters
    const [basePartWithMaybeSvg, queryPart] = badgeUrl?.split("?") || [];

    // Separate the optional .svg extension first
    let basePart = basePartWithMaybeSvg;
    let hasSvg = false;
    if (basePart?.endsWith(".svg")) {
      basePart = basePart.slice(0, -4);
      hasSvg = true;
    }

    // Parse the base part (label-message-color)
    // Regex: label - greedy message - color (non-hyphen)
    const baseMatch = basePart?.match(/^([^-]+)-(.+)-([^-]+)$/);
    if (!baseMatch) return null;

    // Extract components
    const [, encodedLabel, encodedMessage, color] = baseMatch;

    // Decode the URL-encoded parts
    const label = encodedLabel ? decodeURIComponent(encodedLabel) : "";
    const message = encodedMessage ? decodeURIComponent(encodedMessage) : "";

    // Parse query parameters
    const params: Record<string, string> = {};
    if (queryPart) {
      queryPart.split("&").forEach((param) => {
        const [key, value = ""] = param.split("=");
        if (key) {
          params[key] = value;
        }
      });
    }

    // Return the parsed components
    return {
      label,
      message,
      color: color || undefined,
      logo: params.logo,
      logoColor: params.logoColor,
      labelColor: params.labelColor,
      style: params.style,
    };
  }

  /**
   * Updates a shields.io badge URL with new options
   * @param originalUrl The original shields.io badge URL
   * @param options Update options
   * @returns Updated shields.io badge URL
   */
  public updateBadgeUrl(
    originalUrl: string,
    options: BadgeUpdateOptions
  ): string {
    // Extract the badge part from the URL
    const badgeUrlMatch = originalUrl.match(
      /https:\/\/img\.shields\.io\/badge\/([^)]+)/
    );

    // Check if match found, index is valid, and the full match string exists
    if (
      !badgeUrlMatch ||
      typeof badgeUrlMatch.index !== "number" ||
      !badgeUrlMatch[0]
    ) {
      return originalUrl;
    }

    const badgePart = badgeUrlMatch[1]; // Group 1
    const matchIndex = badgeUrlMatch.index;
    const fullMatchString = badgeUrlMatch[0];

    const prefixPart = originalUrl.substring(0, matchIndex);
    const suffixPart = originalUrl.substring(
      matchIndex + fullMatchString.length
    );

    // Split by query parameters
    const [basePart, queryPart] = badgePart?.split("?") || [];

    // Parse the base part (label-message-color.svg)
    const baseMatch = basePart?.match(/([^-]+)-([^-]+)-([^.]+)\.svg/);
    if (!baseMatch) return originalUrl;

    // Extract components
    let [, label, message, color] = baseMatch;

    // Update components based on options
    if (options.label) {
      label = encodeURIComponent(options.label);
    }

    if (options.message) {
      message = encodeURIComponent(options.message);
    }

    if (options.color) {
      color = options.color;
    }

    // Build the base part of the new URL
    let newBadgeUrl = `${label}-${message}-${color}.svg`;

    // Parse and update query parameters
    const params = new URLSearchParams();
    if (queryPart) {
      queryPart.split("&").forEach((param) => {
        const [key, value = ""] = param.split("=");
        if (key) {
          params.append(key, value);
        }
      });
    }

    // Update with new parameters if provided
    if (options.logo) params.set("logo", options.logo);
    if (options.logoColor) params.set("logoColor", options.logoColor);
    if (options.style) params.set("style", options.style);
    if (options.labelColor) params.set("labelColor", options.labelColor);

    // Add query parameters if any exist
    const newQueryString = params.toString();
    if (newQueryString) {
      newBadgeUrl += `?${newQueryString}`;
    }

    // Reconstruct the full URL
    return `${prefixPart}https://img.shields.io/badge/${newBadgeUrl}${suffixPart}`;
  }

  /**
   * Generates markdown for a badge
   * @param badge Badge object
   * @returns Markdown string for the badge
   */
  public generateBadgeMarkdown(badge: Badge): string {
    return `[![${badge.label}](${badge.url})](${badge.linkUrl})`;
  }

  /**
   * Updates a badge in markdown text
   * @param markdown The original markdown text
   * @param badgeIndex Index of the badge to update (as returned by parseBadgesFromMarkdown)
   * @param options Update options
   * @returns Updated markdown text
   */
  public updateBadgeInMarkdown(
    markdown: string,
    badgeIndex: number,
    options: BadgeUpdateOptions
  ): string {
    const badges = this.parseBadgesFromMarkdown(markdown);

    if (badgeIndex < 0 || badgeIndex >= badges.length) {
      throw new Error(`Badge index out of range: ${badgeIndex}`);
    }

    // Add '!' to assert badge is not undefined after the check
    const badge = badges[badgeIndex]!;

    // Update the badge URL
    const updatedUrl = this.updateBadgeUrl(badge.url, options);

    // Create updated badge object
    const updatedBadge: Badge = {
      ...badge,
      url: updatedUrl,
      label: options.label || badge.label,
      message: options.message || badge.message,
      color: options.color || badge.color,
      linkUrl: options.linkUrl || badge.linkUrl,
      logo: options.logo !== undefined ? options.logo : badge.logo,
      logoColor:
        options.logoColor !== undefined ? options.logoColor : badge.logoColor,
      style: options.style !== undefined ? options.style : badge.style,
      labelColor:
        options.labelColor !== undefined
          ? options.labelColor
          : badge.labelColor,
      startIndex: badge.startIndex,
      endIndex: badge.endIndex,
    };

    // Generate new markdown for this badge
    const newMarkdown = this.generateBadgeMarkdown(updatedBadge);

    // Replace the old markdown segment using indices
    const prefix = markdown.substring(0, badge.startIndex);
    const suffix = markdown.substring(badge.endIndex);

    return prefix + newMarkdown + suffix;
  }

  /**
   * Updates all badges matching a filter function
   * @param markdown The original markdown text
   * @param filterFn Function to determine which badges to update
   * @param options Update options
   * @returns Updated markdown text
   */
  public updateMatchingBadges(
    markdown: string,
    filterFn: (badge: Badge) => boolean,
    options: BadgeUpdateOptions
  ): string {
    const badges = this.parseBadgesFromMarkdown(markdown);
    let resultMarkdown = "";
    let lastIndex = 0;

    badges.forEach((badge) => {
      // Append text between the last badge and the current one
      resultMarkdown += markdown.substring(lastIndex, badge.startIndex);

      if (filterFn(badge)) {
        // Generate updated badge markdown if it matches the filter
        const updatedUrl = this.updateBadgeUrl(badge.url, options);
        const updatedBadgeData = {
          ...badge,
          ...options, // Apply updates
          url: updatedUrl, // Ensure URL is the updated one
        };
        // Regenerate the linkUrl if provided in options, otherwise keep original
        updatedBadgeData.linkUrl = options.linkUrl || badge.linkUrl;
        resultMarkdown += this.generateBadgeMarkdown(updatedBadgeData);
      } else {
        // Append the original badge markdown if it doesn't match
        resultMarkdown += badge.markdown;
      }

      // Update lastIndex to the end of the current badge
      lastIndex = badge.endIndex;
    });

    // Append any remaining text after the last badge
    resultMarkdown += markdown.substring(lastIndex);

    return resultMarkdown;
  }

  /**
   * Creates a new shields.io badge
   * @param label Badge label text
   * @param message Badge message text
   * @param color Badge color
   * @param linkUrl URL to link to
   * @param options Additional badge options
   * @returns Markdown string for the new badge
   */
  public createBadge(
    label: string,
    message: string,
    color: string,
    linkUrl: string,
    options: Omit<
      BadgeUpdateOptions,
      "label" | "message" | "color" | "linkUrl"
    > = {}
  ): string {
    // Create base URL
    let url = `https://img.shields.io/badge/${encodeURIComponent(
      label
    )}-${encodeURIComponent(message)}-${color}.svg`;

    // Add query parameters
    const params = new URLSearchParams();
    if (options.logo) params.set("logo", options.logo);
    if (options.logoColor) params.set("logoColor", options.logoColor);
    if (options.style) params.set("style", options.style);
    if (options.labelColor) params.set("labelColor", options.labelColor);

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    // Generate markdown
    return `[![${label}](${url})](${linkUrl})`;
  }
}
