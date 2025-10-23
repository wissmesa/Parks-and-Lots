// Facebook Post Configuration
// Maps park names to their Facebook IDs and webhook settings

export interface FacebookParkConfig {
  parkName: string;
  facebookId: string;
}

export const FACEBOOK_WEBHOOK_URL = 'https://hook.us2.make.com/6layguqfpk3i6imvyg7i96wc2fffewn2';

export const FACEBOOK_PARK_MAPPINGS: FacebookParkConfig[] = [
  {
    parkName: 'Richmond',
    facebookId: '321325917734508'
  },
  {
    parkName: 'Aberdeen Estates',
    facebookId: '240633272475459'
  },
  {
    parkName: 'Amelia Estates',
    facebookId: '114923781526224'
  },
  {
    parkName: 'Aurora Estates',
    facebookId: '620221604502913'
  },
  {
    parkName: 'Creekside Crossing',
    facebookId: '319339847930489'
  },
  {
    parkName: 'Deluxe',
    facebookId: '353098991211829'
  },
  {
    parkName: 'Eastlane',
    facebookId: '103477896023777'
  },
  {
    parkName: 'Ontario Place',
    facebookId: '694757763724654'
  },
  {
    parkName: 'High Meadows MHP',
    facebookId: '427458087107212'
  },
  {
    parkName: 'Three Rivers',
    facebookId: '692084087327854'
  },
  {
    parkName: 'Rustic Acres',
    facebookId: '738689052659408'
  },
  {
    parkName: 'Homestead Village',
    facebookId: '100815996313376'
  }
];

// Helper function to get Facebook config by park name
export function getFacebookConfigByParkName(parkName: string): FacebookParkConfig | undefined {
  return FACEBOOK_PARK_MAPPINGS.find(config => 
    config.parkName.toLowerCase() === parkName.toLowerCase()
  );
}

// Helper function to get Facebook config by park ID (if needed)
export function getFacebookConfigByParkId(parkId: string): FacebookParkConfig | undefined {
  // This would need to be implemented if we need to map by park ID instead of name
  // For now, we'll use park name matching
  return undefined;
}
