export const RECOMMENDED_LOGO_WIDTH = 1200;
export const RECOMMENDED_LOGO_HEIGHT = 300;
export const MINIMUM_LOGO_WIDTH = 600;
export const MINIMUM_LOGO_HEIGHT = 150;
export const MINIMUM_LANDSCAPE_RATIO = 2;

export interface LogoDimensionAssessment {
  suitable: boolean;
  message: string;
}

export function assessLandscapeLogo(
  width: number,
  height: number,
): LogoDimensionAssessment {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      suitable: false,
      message: "The logo dimensions could not be read. Check the file before publishing.",
    };
  }

  if (width / height < MINIMUM_LANDSCAPE_RATIO) {
    return {
      suitable: false,
      message: `${width} x ${height}px is too square for the header. Use a landscape council wordmark at least twice as wide as it is tall.`,
    };
  }

  if (width < MINIMUM_LOGO_WIDTH || height < MINIMUM_LOGO_HEIGHT) {
    return {
      suitable: false,
      message: `${width} x ${height}px may look soft on larger screens. Use at least ${MINIMUM_LOGO_WIDTH} x ${MINIMUM_LOGO_HEIGHT}px.`,
    };
  }

  return {
    suitable: true,
    message: `${width} x ${height}px has a suitable landscape shape for the platform header.`,
  };
}
