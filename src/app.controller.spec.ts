import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let mockAppService: Record<string, Mock>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAppService = {
      getHello: vi.fn().mockReturnValue('Hello World!'),
    };

    appController = new AppController(mockAppService as unknown as AppService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
      expect(mockAppService.getHello).toHaveBeenCalled();
    });
  });
});
