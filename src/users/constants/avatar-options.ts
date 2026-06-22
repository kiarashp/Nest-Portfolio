// Upload these illustrations to Cloudinary once via the dashboard, then paste
// each secure_url into the corresponding `url` field below.
export const AVATAR_OPTIONS = [
  {
    key: 'avatar-1',
    label: 'Avatar 1',
    url: 'https://res.cloudinary.com/dpcvjcmyj/image/upload/v1782152508/avatar1_lulhrq.jpg',
  },
  {
    key: 'avatar-2',
    label: 'Avatar 2',
    url: 'https://res.cloudinary.com/dpcvjcmyj/image/upload/v1782152508/avatar8_jmkvxc.jpg',
  },
  {
    key: 'avatar-3',
    label: 'Avatar 3',
    url: 'https://res.cloudinary.com/dpcvjcmyj/image/upload/v1782152507/avatar6_fd7yrz.jpg',
  },
  {
    key: 'avatar-4',
    label: 'Avatar 4',
    url: 'https://res.cloudinary.com/dpcvjcmyj/image/upload/v1782152507/avatar7_che3sk.jpg',
  },
  {
    key: 'avatar-5',
    label: 'Avatar 5',
    url: 'https://res.cloudinary.com/dpcvjcmyj/image/upload/v1782152507/avatar3_rnhe2h.jpg',
  },
  {
    key: 'avatar-6',
    label: 'Avatar 6',
    url: 'https://res.cloudinary.com/dpcvjcmyj/image/upload/v1782152507/avatar5_ytt7l3.jpg',
  },
  {
    key: 'avatar-7',
    label: 'Avatar 7',
    url: 'https://res.cloudinary.com/dpcvjcmyj/image/upload/v1782152507/avatar4_oieayu.jpg',
  },
  {
    key: 'avatar-8',
    label: 'Avatar 8',
    url: 'https://res.cloudinary.com/dpcvjcmyj/image/upload/v1782152507/avatar2_q5jugc.jpg',
  },
] as const

export type AvatarKey = (typeof AVATAR_OPTIONS)[number]['key']
