// Facebook Post Configuration
// Maps park names to their Facebook IDs and webhook settings

export interface FacebookParkConfig {
  parkName: string;
  facebookId: string;
}

export const FACEBOOK_WEBHOOK_URL = 'https://hook.us2.make.com/6layguqfpk3i6imvyg7i96wc2fffewn2';

export const FACEBOOK_PARK_MAPPINGS: FacebookParkConfig[] = [
  {
    parkName: 'Richmond Mobile Home Park',
    facebookId: '321325917734508'
  },
  {
    parkName: 'Aberdeen Mobile Home Park',
    facebookId: '240633272475459'
  },
  {
    parkName: 'Amelia Mobile Home Park',
    facebookId: '114923781526224'
  },
  {
    parkName: 'Aurora Mobile Home Park',
    facebookId: '620221604502913'
  },
  {
    parkName: 'CreekSide Mobile Home Park',
    facebookId: '319339847930489'
  },
  {
    parkName: 'Deluxe Mobile Home Park',
    facebookId: '353098991211829'
  },
  {
    parkName: 'Eastlane Mobile Home Park',
    facebookId: '103477896023777'
  },
  {
    parkName: 'Ontario Mobile Home Park',
    facebookId: '694757763724654'
  },
  {
    parkName: 'High Meadows Mobile Home Park',
    facebookId: '427458087107212'
  },
  {
    parkName: 'Three Rivers Mobile Home Park',
    facebookId: '692084087327854'
  },
  {
    parkName: 'Rustic Mobile Home Park',
    facebookId: '738689052659408'
  },
  {
    parkName: 'Homestead Mobile Home Park',
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
