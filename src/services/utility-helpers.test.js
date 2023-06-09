import * as util from './utility-helpers';

describe('util helper', () => {
  describe('timeToS()', () => {
    test('with format hh:mm:ss.ms', () => {
      const timeStr = '00:09:17.600';
      expect(util.timeToS(timeStr)).toEqual(557.6);
    });

    test('with format mm:ss.ms', () => {
      const timeStr = '09:12.100';
      expect(util.timeToS(timeStr)).toEqual(552.1);
    });
  });

  describe('createTimestamp()', () => {
    test('with hours', () => {
      expect(util.createTimestamp(557.65, true)).toEqual('00:09:17');
    });

    test('without hours', () => {
      expect(util.createTimestamp(557.65, false)).toEqual('09:17');
    });
  });


  describe('getCanvasTarget()', () => {
    const targets = [
      { start: 0, end: 2455, altStart: 0, duration: 2455, sIndex: 0 },
      { start: 0, end: 3131, altStart: 2455, duration: 3131, sIndex: 1 }];

    it('when timefragment is within first range', () => {
      const { srcIndex, fragmentStart } = util.getCanvasTarget(targets, { start: 231, end: 345 }, 2455);
      expect(srcIndex).toEqual(0);
      expect(fragmentStart).toEqual(231);
    });

    it('when timefragment is within second range', () => {
      const { srcIndex, fragmentStart } = util.getCanvasTarget(targets, { start: 3455, end: 4000 }, 3131);
      expect(srcIndex).toEqual(1);
      expect(fragmentStart).toEqual(1000);
    });
  });

  describe('getMediaFragment()', () => {
    it('returns a start/end helper object from a uri', () => {
      const expectedObject = { start: 374, end: 525 };
      expect(
        util.getMediaFragment(
          'http://example.com/sample/manifest/canvas/1#t=374,525', 1985
        )
      ).toEqual(expectedObject);
    });

    it('returns undefined when uri without time is passed', () => {
      const noTime = util.getMediaFragment(
        'http://example.com/sample/manifest/range/1-4', 1985
      );

      expect(noTime).toBeUndefined();
    });

    it('returns duration when end time is not defined', () => {
      const expectedObject = { start: 670, end: 1985 };
      expect(
        util.getMediaFragment(
          'http://example.com/sample/manifest/canvas/1#t=670', 1985
        )
      ).toEqual(expectedObject);
    });

    it('returns undefined when invalid uri is given', () => {
      expect(util.getMediaFragment(undefined, 1985)).toBeUndefined();
    });
  });

  describe('getResourceItems()', () => {
    test('with zero annotations', () => {
      expect(util.getResourceItems([], 572.32)).toEqual({
        error: 'No resources found in Manifest',
        resources: []
      });
    });

    test('with multiple choice annotations', () => {
      const annotations = [
        {
          __jsonld: {
            body: {
              type: 'Choice',
              items: [
                {
                  id: 'http://example.com/manifest/English.vtt',
                  label: [{ value: 'Captions in WebVTT format', locale: 'en' }],
                  language: 'en',
                  type: 'Text',
                  format: 'text/vtt',
                },
                {
                  id: 'http://example.com/manifest/Italian.vtt',
                  label: [{ value: 'Sottotitoli in formato WebVTT', locale: 'it' }],
                  language: 'it',
                  type: 'Text',
                  format: 'text/vtt',
                }
              ]
            }
          },
          getBody: jest.fn(() => {
            return [
              {
                id: 'http://example.com/manifest/English.vtt',
                getProperty: jest.fn((prop) => {
                  return annotations[0].__jsonld.body.items[0][prop];
                }),
                getLabel: jest.fn(() => {
                  return annotations[0].__jsonld.body.items[0].label;
                })
              },
              {
                id: 'http://example.com/manifest/Italian',
                getProperty: jest.fn((prop) => {
                  return annotations[0].__jsonld.body.items[1][prop];
                }),
                getLabel: jest.fn(() => {
                  return annotations[0].__jsonld.body.items[1].label;
                })
              }
            ];
          }),
        }
      ];
      const { resources, canvasTargets, isMultiSource } = util.getResourceItems(annotations, 572.32);
      expect(resources).toHaveLength(2);
      expect(canvasTargets).toHaveLength(0);
      expect(resources[0]).toEqual({
        src: 'http://example.com/manifest/English.vtt',
        type: 'text/vtt',
        kind: 'Text',
        label: 'Captions in WebVTT format',
        value: '',
      });
      expect(isMultiSource).toBeFalsy();
    });

    test('with multiple annotations', () => {
      const annotations = [
        {
          id: 'http://example.com/manifest/canvas/1/page/annotation/2',
          type: 'Annotation',
          motivation: 'painting',
          body: {
            id: 'http://example.com/manifest/media_part1.mp4',
            label: [{ value: 'Part 1', locale: 'en' }],
            type: 'Video',
            format: 'video/mp4',
            duration: 572.32,
            height: 1080,
            width: 1920,
          },
          target: 'http://example.com/manifest/canvas/1#t=0,572.32',
          getBody: jest.fn(() => {
            return [
              {
                id: 'http://example.com/manifest/media_part1.mp4',
                getProperty: jest.fn((prop) => {
                  return annotations[0].body[prop];
                }),
                getLabel: jest.fn(() => {
                  return annotations[0].body.label;
                })
              }
            ];
          }),
          getTarget: jest.fn(() => {
            return annotations[0].target;
          })
        },
        {
          id: 'http://example.com/manifest/canvas/1/page/annotation/2',
          type: 'Annotation',
          motivation: 'painting',
          body: {
            id: 'http://example.com/manifest/media_part2.mp4',
            label: [{ value: 'Part 2', locale: 'en' }],
            type: 'Video',
            format: 'video/mp4',
            duration: 324.23,
            height: 1080,
            width: 1920,
          },
          target: 'http://example.com/manifest/canvas/1#t=572.32',
          getBody: jest.fn(() => {
            return [
              {
                id: 'http://example.com/manifest/media_part2.mp4',
                getProperty: jest.fn((prop) => {
                  return annotations[1].body[prop];
                }),
                getLabel: jest.fn(() => {
                  return annotations[1].body.label;
                })
              },
            ];
          }),
          getTarget: jest.fn(() => {
            return annotations[1].target;
          })
        }
      ];
      const { resources, canvasTargets, isMultiResource } = util.getResourceItems(annotations, 896.55);
      expect(resources).toHaveLength(2);
      expect(canvasTargets).toHaveLength(2);
      expect(resources[0]).toEqual({
        src: 'http://example.com/manifest/media_part1.mp4',
        type: 'video/mp4',
        kind: 'Video',
        label: 'Part 1',
        value: '',
      });
      expect(canvasTargets[1]).toEqual({
        id: 'http://example.com/manifest/canvas/1/page/annotation/2',
        start: 0, end: 324.23, altStart: 572.32, duration: 324.23, sIndex: 1
      });
      expect(isMultiResource).toBeFalsy();
    });

    test('with annotations undefined', () => {
      expect(util.getResourceItems(undefined, 572.32)).toEqual({
        resources: [], error: 'No resources found in Manifest'
      });
    });
  });

  describe('timeToHHmmss()', () => {
    test('for milli-seconds', () => {
      expect(util.timeToHHmmss(0.34)).toEqual('00:00');
    });

    test('for seconds', () => {
      expect(util.timeToHHmmss(30.04)).toEqual('00:30');
    });

    test('for minutes', () => {
      expect(util.timeToHHmmss(65.94)).toEqual('01:05');
    });

    test('for hours', () => {
      expect(util.timeToHHmmss(3675)).toEqual('01:01:15');
    });
  });

  describe('fileDownload()', () => {
    let originalConsole, link, createElementSpy;
    beforeEach(() => {
      originalConsole = console.log;
      console.log = jest.fn();

      link = {
        click: jest.fn(),
        href: '',
        download: '',
        style: { display: '' },
        setAttribute: jest.fn(),
      };
      createElementSpy = jest.spyOn(document, 'createElement').mockReturnValueOnce(link);
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
    });
    afterEach(() => {
      console.log = originalConsole;
    });
    test('successful download', () => {
      util.fileDownload('https://example.com/transcript.json', 'Transcript test');

      expect(createElementSpy).toBeCalledWith('a');
      expect(link.setAttribute.mock.calls.length).toBe(2);
      expect(link.setAttribute.mock.calls[0]).toEqual(['href', 'https://example.com/transcript.json']);
      expect(link.setAttribute.mock.calls[1]).toEqual(['download', 'Transcript test.json']);
      expect(link.style.display).toBe('none');
      expect(document.body.appendChild).toBeCalledWith(link);
      expect(link.click).toBeCalled();
      expect(document.body.removeChild).toBeCalledWith(link);
    });

    describe('for machine-generated transcripts', () => {
      test('with machine generared text in title', () => {
        util.fileDownload('https://example.com/transcript.json', 'Transcript test (machine-generated)', true);

        expect(createElementSpy).toBeCalledWith('a');
        expect(link.setAttribute.mock.calls.length).toBe(2);
        expect(link.setAttribute.mock.calls[0]).toEqual(['href', 'https://example.com/transcript.json']);
        expect(link.setAttribute.mock.calls[1]).toEqual(['download', 'Transcript test (machine-generated).json']);
        expect(link.style.display).toBe('none');
        expect(document.body.appendChild).toBeCalledWith(link);
        expect(link.click).toBeCalled();
        expect(document.body.removeChild).toBeCalledWith(link);
      });

      test('without machine generared text in title adds it to file name', () => {
        util.fileDownload('https://example.com/transcript.json', 'Transcript test', true);

        expect(createElementSpy).toBeCalledWith('a');
        expect(link.setAttribute.mock.calls.length).toBe(2);
        expect(link.setAttribute.mock.calls[0]).toEqual(['href', 'https://example.com/transcript.json']);
        expect(link.setAttribute.mock.calls[1]).toEqual(['download', 'Transcript test (machine generated).json']);
        expect(link.style.display).toBe('none');
        expect(document.body.appendChild).toBeCalledWith(link);
        expect(link.click).toBeCalled();
        expect(document.body.removeChild).toBeCalledWith(link);
      });
    });
  });

});