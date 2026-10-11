// Independent painted-object expectations from three native V6 review receipts.
// These literal source pixels and original image hashes deliberately do not import
// application cropBounds, masks, or the application painted-bounds table.
// A passing projection supplements, never replaces, independent picture review.
export const PAINTED_ENDPOINT_REFERENCES = [
  {
    cardName: 'Ace of Cups',
    detailId: 'overflowing-cup',
    sourceImage: '/images/cards/rws-vector/cups-01.webp',
    sourceSha256: '8af1c484149c3659a2e5485bdcc41321f999041b9166ebe960bd44fa0a01c713',
    width: 1086,
    height: 1810,
    bounds: {
      left: 360,
      top: 265,
      right: 730,
      bottom: 1575
    },
    landmarks: [
      {
        name: 'right upper water-loop apex',
        x: 652,
        y: 281
      },
      {
        name: 'left outer stream pond endpoint',
        x: 382,
        y: 1546
      },
      {
        name: 'central stream pond endpoint',
        x: 605,
        y: 1484
      },
      {
        name: 'right outer stream pond endpoint',
        x: 704,
        y: 1555
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      }
    ]
  },
  {
    cardName: 'Ace of Wands',
    detailId: 'sprout',
    sourceImage: '/images/cards/rws-vector/wands-01.webp',
    sourceSha256: 'b2ca0bc5ea74c789e9547022b9592fae791aedae986463e7290e4b168084af28',
    width: 1086,
    height: 1810,
    bounds: {
      left: 205,
      top: 65,
      right: 625,
      bottom: 1390
    },
    landmarks: [
      {
        name: 'topmost sprouting leaf',
        x: 377,
        y: 81
      },
      {
        name: 'left floating leaf',
        x: 229,
        y: 682
      },
      {
        name: 'right floating leaf',
        x: 610,
        y: 376
      },
      {
        name: 'lower painted wand cap',
        x: 435,
        y: 1374
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-majors-and-relationships-v6-crop-discovery-final.json',
        sha256: '432d19e1925d8a70c1effbae53e6bc94521692dc76f56ff5f993d220f9ef0dc6'
      }
    ]
  },
  {
    cardName: 'Eight of Wands',
    detailId: 'flying-staffs',
    sourceImage: '/images/cards/rws-vector/wands-08.webp',
    sourceSha256: '3d3d772ed54ca9ac81c40835a4275fad25ac1c71bd1e780aa7f12e2b9577d8b0',
    width: 1086,
    height: 1810,
    bounds: {
      left: 61,
      top: 182,
      right: 1000,
      bottom: 1690
    },
    landmarks: [
      {
        name: 'highest staff source-visible left end',
        x: 68,
        y: 209
      },
      {
        name: 'second upper staff leafy tip',
        x: 985,
        y: 708
      },
      {
        name: 'seventh staff leafy tip',
        x: 891,
        y: 1504
      },
      {
        name: 'lowest eighth staff leaf tip',
        x: 851,
        y: 1671
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'Five of Pentacles',
    detailId: 'stained-glass',
    sourceImage: '/images/cards/rws-vector/pentacles-05.webp',
    sourceSha256: '8b9ca961e15f595f96230a6192cf40b916637b00d9afd65b46578b6dda915df6',
    width: 1086,
    height: 1810,
    bounds: {
      left: 244,
      top: 25,
      right: 854,
      bottom: 878
    },
    landmarks: [
      {
        name: 'upper yellow pane at source border',
        x: 533,
        y: 41
      },
      {
        name: 'lower outer left frame corner',
        x: 257,
        y: 866
      },
      {
        name: 'lower outer frame edge',
        x: 576,
        y: 862
      },
      {
        name: 'right outer stone jamb',
        x: 837,
        y: 740
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      }
    ]
  },
  {
    cardName: 'Five of Wands',
    detailId: 'staffs',
    sourceImage: '/images/cards/rws-vector/wands-05.webp',
    sourceSha256: '511c2053094ebfef55a56438b2c48606b1f44b54358a0278fe6e935033ce24e1',
    width: 1086,
    height: 1810,
    bounds: {
      left: 130,
      top: 75,
      right: 1008,
      bottom: 1235
    },
    landmarks: [
      {
        name: 'highest left staff leaf',
        x: 175,
        y: 90
      },
      {
        name: 'rightmost staff upper leaf',
        x: 856,
        y: 184
      },
      {
        name: 'lowest carried staff end',
        x: 444,
        y: 1216
      },
      {
        name: 'right diagonal staff end',
        x: 965,
        y: 432
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      },
      {
        artifact: 'artwork-review-majors-and-relationships-v6-crop-discovery-final.json',
        sha256: '432d19e1925d8a70c1effbae53e6bc94521692dc76f56ff5f993d220f9ef0dc6'
      }
    ]
  },
  {
    cardName: 'Judgement',
    detailId: 'trumpet',
    sourceImage: '/images/cards/rws-vector/major-20-judgement.webp',
    sourceSha256: 'e78385894386e1099d7e2f914cbb9c88a8d9e70821059d69853982a243c09fb9',
    width: 1086,
    height: 1810,
    bounds: {
      left: 266,
      top: 345,
      right: 745,
      bottom: 991
    },
    landmarks: [
      {
        name: 'gold mouthpiece at angel lips',
        x: 531,
        y: 366
      },
      {
        name: 'left banner corner',
        x: 277,
        y: 674
      },
      {
        name: 'bell outer right',
        x: 733,
        y: 931
      },
      {
        name: 'bell lower rim',
        x: 616,
        y: 982
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-majors-and-relationships-v6-crop-discovery-final.json',
        sha256: '432d19e1925d8a70c1effbae53e6bc94521692dc76f56ff5f993d220f9ef0dc6'
      }
    ]
  },
  {
    cardName: 'Justice',
    detailId: 'upright-sword',
    sourceImage: '/images/cards/rws-vector/major-11-justice.webp',
    sourceSha256: '557d04daccb3e8927a1b2cd189ce715e3a69eb17acb89cc1eb78467c7e24167d',
    width: 1086,
    height: 1810,
    bounds: {
      left: 88,
      top: 42,
      right: 282,
      bottom: 768
    },
    landmarks: [
      {
        name: 'blade pointed tip',
        x: 176,
        y: 51
      },
      {
        name: 'left guard end',
        x: 98,
        y: 612
      },
      {
        name: 'right guard end',
        x: 269,
        y: 610
      },
      {
        name: 'pommel bottom',
        x: 183,
        y: 760
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-majors-and-relationships-v6-crop-discovery-final.json',
        sha256: '432d19e1925d8a70c1effbae53e6bc94521692dc76f56ff5f993d220f9ef0dc6'
      }
    ]
  },
  {
    cardName: 'King of Swords',
    detailId: 'held-sword',
    sourceImage: '/images/cards/rws-vector/swords-14.webp',
    sourceSha256: '39b3ef8091c9c3a979971934537b257d943418d88d4c664597c28f8be083a3d8',
    width: 1086,
    height: 1810,
    bounds: {
      left: 250,
      top: 102,
      right: 476,
      bottom: 928
    },
    landmarks: [
      {
        name: 'upper blade tip',
        x: 272,
        y: 114
      },
      {
        name: 'crossguard left end',
        x: 320,
        y: 789
      },
      {
        name: 'crossguard right end',
        x: 458,
        y: 784
      },
      {
        name: 'round lower pommel',
        x: 405,
        y: 910
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'King of Wands',
    detailId: 'held-wand',
    sourceImage: '/images/cards/rws-vector/wands-14.webp',
    sourceSha256: 'df4236776cc8a49452180812497443cb3d9528ca0087094206f4e4ba50f89cd9',
    width: 1086,
    height: 1810,
    bounds: {
      left: 95,
      top: 174,
      right: 282,
      bottom: 1502
    },
    landmarks: [
      {
        name: 'highest upper leaf',
        x: 209,
        y: 186
      },
      {
        name: 'right lateral leaf',
        x: 260,
        y: 470
      },
      {
        name: 'hand grip on wand',
        x: 165,
        y: 816
      },
      {
        name: 'ground wand base',
        x: 126,
        y: 1485
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'Knight of Swords',
    detailId: 'raised-sword',
    sourceImage: '/images/cards/rws-vector/swords-12.webp',
    sourceSha256: 'd7e35533796832e117579dd90323cfb25f3e0e83136cfa5aadeba4bc1eb04e31',
    width: 1086,
    height: 1810,
    bounds: {
      left: 218,
      top: 38,
      right: 402,
      bottom: 508
    },
    landmarks: [
      {
        name: 'blade original top-border crossing',
        x: 243,
        y: 48
      },
      {
        name: 'crossguard left end',
        x: 245,
        y: 367
      },
      {
        name: 'crossguard right end',
        x: 389,
        y: 354
      },
      {
        name: 'round lower pommel',
        x: 350,
        y: 487
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'Knight of Wands',
    detailId: 'rearing-horse',
    sourceImage: '/images/cards/rws-vector/wands-12.webp',
    sourceSha256: '267d2acbdb9f54a53cb78fb96c3603bf1b12bd409420f5aaa456f02dedd9539e',
    width: 1086,
    height: 1810,
    bounds: {
      left: 64,
      top: 548,
      right: 1008,
      bottom: 1595
    },
    landmarks: [
      {
        name: 'upper horse mane ear silhouette',
        x: 356,
        y: 558
      },
      {
        name: 'muzzle leading outline',
        x: 134,
        y: 706
      },
      {
        name: 'raised foreleg lower hoof',
        x: 114,
        y: 1208
      },
      {
        name: 'source-visible rear body at original right edge',
        x: 1001,
        y: 1320
      },
      {
        name: 'lower rear-leg source-visible continuation',
        x: 803,
        y: 1584
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v9-rearing-horse-whole-source-diagnostic-and-corrections.json',
        sha256: '5ed624a757deabfa1610696ee67a6207e8b3f13be538acb84aa8ce8400cf40c3'
      },
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'Nine of Pentacles',
    detailId: 'grape-vines',
    sourceImage: '/images/cards/rws-vector/pentacles-09.webp',
    sourceSha256: '328398217eee64521ca5482acf191950a9ec20df9a494208d135c79c2e25a467',
    width: 1086,
    height: 1810,
    bounds: {
      left: 62,
      top: 665,
      right: 1005,
      bottom: 1600
    },
    landmarks: [
      {
        name: 'upper left grape bunch berry',
        x: 169,
        y: 828
      },
      {
        name: 'lower left grape bunch berry',
        x: 77,
        y: 1409
      },
      {
        name: 'lower right grape bunch berry',
        x: 985,
        y: 1558
      },
      {
        name: 'middle right hanging bunch lower berry',
        x: 930,
        y: 1074
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      }
    ]
  },
  {
    cardName: 'Page of Cups',
    detailId: 'fish-in-cup',
    sourceImage: '/images/cards/rws-vector/cups-11.webp',
    sourceSha256: '2793f3feb45368c7789642921a07fa6b8f139d0e0d529df34c28ebae7ac883f6',
    width: 1086,
    height: 1810,
    bounds: {
      left: 158,
      top: 433,
      right: 343,
      bottom: 834
    },
    landmarks: [
      {
        name: 'fish upper nose',
        x: 330,
        y: 452
      },
      {
        name: 'fish visible lower tail',
        x: 243,
        y: 512
      },
      {
        name: 'cup bottom foot point',
        x: 273,
        y: 824
      },
      {
        name: 'cup outer base corner',
        x: 201,
        y: 810
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      }
    ]
  },
  {
    cardName: 'Page of Wands',
    detailId: 'upright-staff',
    sourceImage: '/images/cards/rws-vector/wands-11.webp',
    sourceSha256: '0b7ff933188f21db0aa8188915b401ef4a699f30baad336793e2e591e1a8d695',
    width: 1086,
    height: 1810,
    bounds: {
      left: 670,
      top: 166,
      right: 830,
      bottom: 1530
    },
    landmarks: [
      {
        name: 'upper left sprout leaf',
        x: 692,
        y: 180
      },
      {
        name: 'upper staff terminal',
        x: 761,
        y: 183
      },
      {
        name: 'lower lateral leaf',
        x: 803,
        y: 1148
      },
      {
        name: 'ground staff base',
        x: 771,
        y: 1514
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'Queen of Swords',
    detailId: 'upright-sword',
    sourceImage: '/images/cards/rws-vector/swords-13.webp',
    sourceSha256: '6ba1247934bfadd9fd4aa45fe0b5ebb5766c4a884204a2b78e57c753d80532fe',
    width: 1086,
    height: 1810,
    bounds: {
      left: 535,
      top: 115,
      right: 718,
      bottom: 1025
    },
    landmarks: [
      {
        name: 'upper blade tip',
        x: 635,
        y: 124
      },
      {
        name: 'left crossguard end',
        x: 548,
        y: 873
      },
      {
        name: 'right crossguard end',
        x: 704,
        y: 878
      },
      {
        name: 'lower pommel end',
        x: 626,
        y: 1005
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'Seven of Pentacles',
    detailId: 'pentacle-vine',
    sourceImage: '/images/cards/rws-vector/pentacles-07.webp',
    sourceSha256: 'c11e2b936abb15194250c79ce4b31679c0d45e84b361114abff475efb6f5a5e6',
    width: 1086,
    height: 1810,
    bounds: {
      left: 62,
      top: 568,
      right: 610,
      bottom: 1718
    },
    landmarks: [
      {
        name: 'upper vine leaf apex',
        x: 214,
        y: 577
      },
      {
        name: 'right vine tendril endpoint',
        x: 468,
        y: 1077
      },
      {
        name: 'lowest left vine leaf tip',
        x: 116,
        y: 1705
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      }
    ]
  },
  {
    cardName: 'Six of Cups',
    detailId: 'courtyard',
    sourceImage: '/images/cards/rws-vector/cups-06.webp',
    sourceSha256: '1b3cc37f826fd115eed7b8c74e036abec53f9e275f172fc607c6c0110f425fe2',
    width: 1086,
    height: 1810,
    bounds: {
      left: 62,
      top: 294,
      right: 1008,
      bottom: 1145
    },
    landmarks: [
      {
        name: 'left tower roof apex',
        x: 258,
        y: 304
      },
      {
        name: 'middle gable roof apex',
        x: 527,
        y: 500
      },
      {
        name: 'left tower lower visible wall corner',
        x: 136,
        y: 977
      },
      {
        name: 'right building lower visible wall endpoint',
        x: 986,
        y: 1118
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      }
    ]
  },
  {
    cardName: 'Six of Pentacles',
    detailId: 'giving-hand',
    sourceImage: '/images/cards/rws-vector/pentacles-06.webp',
    sourceSha256: 'af273946f0f538317b4383426a9c01c8d6ae56b24b4cac7c27c054c65a149861',
    width: 1086,
    height: 1810,
    bounds: {
      left: 268,
      top: 912,
      right: 422,
      bottom: 1335
    },
    landmarks: [
      {
        name: 'merchant dropping fingertip',
        x: 282,
        y: 988
      },
      {
        name: 'lowest falling coin',
        x: 314,
        y: 1190
      },
      {
        name: 'recipient upper outstretched fingertip',
        x: 408,
        y: 1236
      },
      {
        name: 'recipient lower outstretched fingertip',
        x: 411,
        y: 1296
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      }
    ]
  },
  {
    cardName: 'Six of Wands',
    detailId: 'white-horse',
    sourceImage: '/images/cards/rws-vector/wands-06.webp',
    sourceSha256: '5cd015a019bb5f56d1f0a6768d31ae110decf0f55b966ea76f14e6494382dd9d',
    width: 1086,
    height: 1810,
    bounds: {
      left: 58,
      top: 826,
      right: 1010,
      bottom: 1720
    },
    landmarks: [
      {
        name: 'highest left ear outline',
        x: 905,
        y: 845
      },
      {
        name: 'right ear outer contour',
        x: 994,
        y: 886
      },
      {
        name: 'muzzle lower outline',
        x: 889,
        y: 1212
      },
      {
        name: 'back of bridled neck',
        x: 653,
        y: 1082
      },
      {
        name: 'rear body covering at original left border',
        x: 64,
        y: 1200
      },
      {
        name: 'rear body covering at original lower border',
        x: 146,
        y: 1704
      },
      {
        name: 'front body covering at original lower border',
        x: 955,
        y: 1704
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v9-white-horse-whole-source-diagnostic-and-corrections.json',
        sha256: '0e11771011d5c4274c8f952b0d86aec8fb92f5b45c82610a8566bfcd18d5d04d'
      },
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'Ten of Cups',
    detailId: 'rainbow-cups',
    sourceImage: '/images/cards/rws-vector/cups-10.webp',
    sourceSha256: '83ac066f45a95adc97e6f4792f7731b8f76dc3a0a4d26b4fa970098f437e8d99',
    width: 1086,
    height: 1810,
    bounds: {
      left: 55,
      top: 148,
      right: 1005,
      bottom: 895
    },
    landmarks: [
      {
        name: 'arch crown',
        x: 513,
        y: 158
      },
      {
        name: 'left yellow rainbow tail',
        x: 75,
        y: 835
      },
      {
        name: 'right yellow rainbow tail',
        x: 979,
        y: 880
      },
      {
        name: 'outer right cup base',
        x: 925,
        y: 543
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      }
    ]
  },
  {
    cardName: 'Ten of Wands',
    detailId: 'bundle',
    sourceImage: '/images/cards/rws-vector/wands-10.webp',
    sourceSha256: '5905d56ad14be77e390ec70f0e89b67c6750f5870f9c3a5c7ed5d579e57797d8',
    width: 1086,
    height: 1810,
    bounds: {
      left: 138,
      top: 98,
      right: 984,
      bottom: 1518
    },
    landmarks: [
      {
        name: 'highest right staff leaf',
        x: 901,
        y: 111
      },
      {
        name: 'leftmost staff upper leaf',
        x: 160,
        y: 195
      },
      {
        name: 'lowest central staff base',
        x: 619,
        y: 1501
      },
      {
        name: 'lower right staff base',
        x: 782,
        y: 1426
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'The Devil',
    detailId: 'downward-torch',
    sourceImage: '/images/cards/rws-vector/major-15-devil.webp',
    sourceSha256: '94d4fcc10f10d0d817d23cf5b4bd99fac02ea5aa23aa8228f1132f37d382e126',
    width: 1086,
    height: 1810,
    bounds: {
      left: 881,
      top: 701,
      right: 1034,
      bottom: 1277
    },
    landmarks: [
      {
        name: 'upper handle cap',
        x: 919,
        y: 715
      },
      {
        name: 'shaft below gripping hand',
        x: 966,
        y: 1052
      },
      {
        name: 'flame outer right',
        x: 1021,
        y: 1214
      },
      {
        name: 'flame lower rim',
        x: 958,
        y: 1267
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-majors-and-relationships-v6-crop-discovery-final.json',
        sha256: '432d19e1925d8a70c1effbae53e6bc94521692dc76f56ff5f993d220f9ef0dc6'
      }
    ]
  },
  {
    cardName: 'The High Priestess',
    detailId: 'pillars',
    sourceImage: '/images/cards/rws-vector/major-02-high-priestess.webp',
    sourceSha256: '2bc63fce63dbc6cb03a7ad0f856ff441c3bffff1563f5c2193f5ca769df6eba5',
    width: 1086,
    height: 1810,
    bounds: {
      left: 40,
      top: 197,
      right: 1040,
      bottom: 1598
    },
    landmarks: [
      {
        name: 'black capital highest point',
        x: 104,
        y: 209
      },
      {
        name: 'white capital highest point',
        x: 896,
        y: 245
      },
      {
        name: 'black base terminal lower edge',
        x: 137,
        y: 1587
      },
      {
        name: 'white base terminal lower edge',
        x: 955,
        y: 1585
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-majors-and-relationships-v6-crop-discovery-final.json',
        sha256: '432d19e1925d8a70c1effbae53e6bc94521692dc76f56ff5f993d220f9ef0dc6'
      }
    ]
  },
  {
    cardName: 'The Sun',
    detailId: 'sunflowers',
    sourceImage: '/images/cards/rws-vector/major-19-sun.webp',
    sourceSha256: '128927dab9001cae8bc2e1522e641bdab0284440d4a22fc51caefeab71356cfd',
    width: 1086,
    height: 1810,
    bounds: {
      left: 44,
      top: 734,
      right: 1040,
      bottom: 1109
    },
    landmarks: [
      {
        name: 'left bloom outer left petal',
        x: 49,
        y: 818
      },
      {
        name: 'left bloom upper petal',
        x: 121,
        y: 746
      },
      {
        name: 'fourth bloom outer right petal',
        x: 1029,
        y: 994
      },
      {
        name: 'fourth bloom lower petal',
        x: 959,
        y: 1070
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-majors-and-relationships-v6-crop-discovery-final.json',
        sha256: '432d19e1925d8a70c1effbae53e6bc94521692dc76f56ff5f993d220f9ef0dc6'
      }
    ]
  },
  {
    cardName: 'Three of Pentacles',
    detailId: 'collaborators',
    sourceImage: '/images/cards/rws-vector/pentacles-03.webp',
    sourceSha256: '6f799a5bfb35ac83b0664a8580fc5494991c0c7b219c226dbca6da1ddf103b0d',
    width: 1086,
    height: 1810,
    bounds: {
      left: 60,
      top: 665,
      right: 910,
      bottom: 1725
    },
    landmarks: [
      {
        name: 'artisan cap apex',
        x: 217,
        y: 687
      },
      {
        name: 'artisan boot toe',
        x: 282,
        y: 1492
      },
      {
        name: 'right cloak lower hem corner',
        x: 889,
        y: 1621
      },
      {
        name: 'monk shoe left toe',
        x: 642,
        y: 1701
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v6-discovery-receipt.json',
        sha256: '4e3a8afda890b6d0769421d43b1baff445f87f11f9cc1217c6ae60e4f5b01f9f'
      },
      {
        artifact: 'artwork-review-majors-and-relationships-v6-crop-discovery-final.json',
        sha256: '432d19e1925d8a70c1effbae53e6bc94521692dc76f56ff5f993d220f9ef0dc6'
      }
    ]
  },
  {
    cardName: 'Three of Swords',
    detailId: 'rain',
    sourceImage: '/images/cards/rws-vector/swords-03.webp',
    sourceSha256: '1b700f9b26dd978a9118a51004aad761d1448678bf2814d33c088a6c2ac7207a',
    width: 1086,
    height: 1810,
    bounds: {
      left: 75,
      top: 415,
      right: 995,
      bottom: 1690
    },
    landmarks: [
      {
        name: 'left upper rain beneath cloud',
        x: 430,
        y: 445
      },
      {
        name: 'long lowest left rain end',
        x: 190,
        y: 1673
      },
      {
        name: 'right rain below cloud',
        x: 973,
        y: 772
      },
      {
        name: 'long right rain end',
        x: 834,
        y: 1201
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v6-crop-diagnostic.json',
        sha256: '1230118ebd5ad268d2646e003709cb78df3a5ba9d05edd201ae4ff9b17db2aa8'
      }
    ]
  },
  {
    cardName: 'Knight of Swords',
    detailId: 'charging-horse',
    sourceImage: '/images/cards/rws-vector/swords-12.webp',
    sourceSha256: 'd7e35533796832e117579dd90323cfb25f3e0e83136cfa5aadeba4bc1eb04e31',
    width: 1086,
    height: 1810,
    bounds: {
      left: 64,
      top: 640,
      right: 1005,
      bottom: 1585
    },
    landmarks: [
      {
        name: 'horse ear upper silhouette',
        x: 365,
        y: 650
      },
      {
        name: 'muzzle leading outline',
        x: 126,
        y: 853
      },
      {
        name: 'lower chest into foreleg',
        x: 460,
        y: 1180
      },
      {
        name: 'upper extended foreleg at source left crossing',
        x: 74,
        y: 1468
      },
      {
        name: 'lower source-visible foreleg and hoof near source left edge',
        x: 85,
        y: 1540
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-wands-swords-final-v9-charging-horse-crop-diagnostic.json',
        sha256: '05f3ae6592cb6d1c273397e52ee649a284be86b44e7fe3db2267c79853412c19'
      }
    ]
  },
  {
    cardName: 'Knight of Cups',
    detailId: 'white-horse',
    sourceImage: '/images/cards/rws-vector/cups-12.webp',
    sourceSha256: 'b772688e03f93144b33f291a0a24d6fd6ef1a5270e8dbb04f5e72e4b920376e7',
    width: 1086,
    height: 1810,
    bounds: {
      left: 48,
      top: 633,
      right: 1006,
      bottom: 1574
    },
    landmarks: [
      {
        name: 'upper mane crown silhouette',
        x: 746,
        y: 644
      },
      {
        name: 'muzzle lower silhouette',
        x: 817,
        y: 1071
      },
      {
        name: 'raised forehoof lower contour',
        x: 573,
        y: 1445
      },
      {
        name: 'supporting forehoof original ground contact',
        x: 447,
        y: 1563
      }
    ],
    reviewReceipts: [
      {
        artifact: 'artwork-review-cups-pentacles-final-v9-white-horse-scope-correction.json',
        sha256: 'a05c5349cd8a6f0a8a9eca935c4949df579f0337586f7a781ec7e787bc2ae399'
      }
    ]
  },
  {
    cardName: 'Two of Swords',
    detailId: 'crossed-swords',
    sourceImage: '/images/cards/rws-vector/swords-02.webp',
    sourceSha256: '86ae3d93dfde6606e5598e2090927e23b1899d5620d6f9daf0a550aaf2e99fa5',
    width: 1086,
    height: 1810,
    bounds: {
      left: 54,
      top: 210,
      right: 1018,
      bottom: 885
    },
    landmarks: [
      {
        name: 'upper source-visible left blade cap',
        x: 63,
        y: 225
      },
      {
        name: 'upper source-visible right blade cap',
        x: 1005,
        y: 225
      },
      {
        name: 'left blade dark grip terminal below crossed fingers',
        x: 519,
        y: 864
      },
      {
        name: 'right blade rounded dark grip terminal below crossed fingers',
        x: 558,
        y: 875
      }
    ],
    reviewReceipts: [
      {
        artifact: 'two-of-swords-crossed-swords-v9-cups-independent-scope-review.json',
        sha256: '7af2a48888a593a3ff30470c46be48b9a0a3150c4b2221b6cb81a2f6dd9c114b'
      }
    ]
  }
];

export function getPaintedEndpointReferences(cardName, detailIds) {
  return PAINTED_ENDPOINT_REFERENCES.filter(reference => reference.cardName === cardName && detailIds.includes(reference.detailId));
}

/** Project independently identified original pixels through an actual image box. */
export function projectPaintedEndpointReference(reference, { imageRect, visibleRect, clipRect, reversed }) {
  const project = ({ name, x, y }) => {
    const u = x / reference.width, v = y / reference.height;
    const screenX = reversed ? imageRect.right - u * imageRect.width : imageRect.left + u * imageRect.width;
    const screenY = reversed ? imageRect.bottom - v * imageRect.height : imageRect.top + v * imageRect.height;
    const margin = rect => Math.min(screenX - rect.left, rect.right - screenX, screenY - rect.top, rect.bottom - screenY);
    return { name, sourceX: x, sourceY: y, screenX, screenY, visibleMargin: margin(visibleRect), slotMargin: margin(clipRect) };
  };
  const { left, top, right, bottom } = reference.bounds;
  const corners = [[left, top], [right, top], [left, bottom], [right, bottom]]
    .map(([x, y], index) => project({ name: `complete-object corner ${index}`, x, y }));
  const landmarks = reference.landmarks.map(project);
  return { cardName: reference.cardName, detailId: reference.detailId, sourceImage: reference.sourceImage,
    sourceSha256: reference.sourceSha256, sourceBounds: reference.bounds,
    projectedBounds: { left: Math.min(...corners.map(point => point.screenX)), right: Math.max(...corners.map(point => point.screenX)),
      top: Math.min(...corners.map(point => point.screenY)), bottom: Math.max(...corners.map(point => point.screenY)) },
    corners, landmarks, visibleMargin: Math.min(...[...corners, ...landmarks].map(point => point.visibleMargin)),
    slotMargin: Math.min(...[...corners, ...landmarks].map(point => point.slotMargin)) };
}

/** Checks full rectangles and separately identified landmarks against measured DOM. */
export function evaluatePaintedEndpoints({ art, cardName, detailIds, orientation, compact }) {
  return getPaintedEndpointReferences(cardName, detailIds).map(reference => {
    const projected = projectPaintedEndpointReference(reference, { imageRect: art.imageRect, visibleRect: art.visibleRect,
      clipRect: art.clipRect, reversed: art.orientation.reversed });
    const checks = {
      originalImageMatches: art.image.src === reference.sourceImage && art.image.naturalWidth === reference.width && art.image.naturalHeight === reference.height,
      orientationMatches: art.orientation.reversed === (orientation === 'reversed') && art.reversedAttribute === (orientation === 'reversed'),
      completeObjectVisible: projected.visibleMargin >= -.2,
      completeObjectBreathingRoom: !compact || projected.slotMargin > 2.5
    };
    return { ...projected, checks, passed: Object.values(checks).every(Boolean) };
  });
}
